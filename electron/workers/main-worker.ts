import { createRequire } from 'module'
import { dirname, join } from 'path'
import { parentPort } from 'worker_threads'
import initSqlJs from 'sql.js'
import { getFonts } from 'font-list'
import { assembleChatContext, assembleSkillSummaries } from '../shared/ai-context-assemble'
import {
  GIT_FIELD_SEP,
  parseCommitDetailFromShow,
  parseGraphLog,
} from '../shared/git-parse'
import { parseSettingsImportContent } from '../shared/settings-import-parse'
import {
  groupSessionsByProject,
  openCodeRowsToSessions,
  parseClaudeCodeHistoryContent,
  parseOpenCodeSessionRows,
} from '../shared/session-parse'
import { resolveTextsPure } from '../shared/vault-resolve-pure'
import { decryptPayload, encryptPayload } from '../p2p/p2p-crypto'
import type {
  AiAssembleChatContextPayload,
  AiAssembleSkillSummariesPayload,
  GitParseCommitDetailPayload,
  GitParseGraphLogPayload,
  MainWorkerRequest,
  MainWorkerResponse,
  P2pDecryptPayload,
  P2pEncryptPayload,
  SessionParseClaudeCodePayload,
  SessionParseOpenCodePayload,
  SettingsParseImportPayload,
  VaultResolveBatchPayload,
} from './main-worker-types'

const require = createRequire(import.meta.url)

let sqlInit: ReturnType<typeof initSqlJs> | null = null

async function getSql() {
  if (!sqlInit) {
    const wasmDir = dirname(require.resolve('sql.js'))
    sqlInit = initSqlJs({
      locateFile: (file) => join(wasmDir, file),
    })
  }
  return sqlInit
}

function reply(response: MainWorkerResponse): void {
  parentPort?.postMessage(response)
}

async function handleTask(task: MainWorkerRequest['task'], payload: unknown): Promise<unknown> {
  switch (task) {
    case 'session:parseClaudeCode': {
      const { content } = payload as SessionParseClaudeCodePayload
      const sessions = parseClaudeCodeHistoryContent(content)
      return { sessions, groups: groupSessionsByProject(sessions) }
    }
    case 'session:parseOpenCode': {
      const { dbBuffer } = payload as SessionParseOpenCodePayload
      const SQL = await getSql()
      const db = new SQL.Database(dbBuffer)
      try {
        const queryResult = db.exec(
          `SELECT id, directory, title, time_created
           FROM session
           WHERE id IS NOT NULL AND id != ''
           ORDER BY time_created DESC`,
        )
        const rows = parseOpenCodeSessionRows(queryResult[0])
        const sessions = openCodeRowsToSessions(rows)
        return { sessions, groups: groupSessionsByProject(sessions) }
      } finally {
        db.close()
      }
    }
    case 'git:parseGraphLog': {
      const { stdout, recordSep, cursorSha } = payload as GitParseGraphLogPayload
      const normalized = stdout.replaceAll(recordSep, '\n')
      let rows = parseGraphLog(normalized, GIT_FIELD_SEP)
      if (cursorSha) {
        rows = rows.filter((row) => row.sha !== cursorSha)
      }
      return { rows }
    }
    case 'git:parseCommitDetail': {
      const { showStdout, numstatStdout, statusStdout } = payload as GitParseCommitDetailPayload
      return parseCommitDetailFromShow(showStdout, numstatStdout, statusStdout, GIT_FIELD_SEP)
    }
    case 'ai:assembleChatContext': {
      const { ruleFiles, skillFiles, ruleStates } = payload as AiAssembleChatContextPayload
      return assembleChatContext(ruleFiles, skillFiles, ruleStates)
    }
    case 'ai:assembleSkillSummaries': {
      const { skillFiles } = payload as AiAssembleSkillSummariesPayload
      return assembleSkillSummaries(skillFiles)
    }
    case 'settings:parseImport': {
      const { content } = payload as SettingsParseImportPayload
      return parseSettingsImportContent(content)
    }
    case 'fonts:fetchAndNormalize': {
      const raw = await getFonts({ disableQuoting: true })
      return [...new Set(raw)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }
    case 'vault:resolveBatch': {
      const { texts, variables } = payload as VaultResolveBatchPayload
      return { texts: resolveTextsPure(texts, variables) }
    }
    case 'p2p:encryptPayload': {
      const { sessionKeyBase64, plaintext } = payload as P2pEncryptPayload
      const key = Buffer.from(sessionKeyBase64, 'base64')
      return { result: encryptPayload(key, plaintext) }
    }
    case 'p2p:decryptPayload': {
      const { sessionKeyBase64, encrypted } = payload as P2pDecryptPayload
      const key = Buffer.from(sessionKeyBase64, 'base64')
      return { result: decryptPayload(key, encrypted) }
    }
    default:
      throw new Error(`Unknown task: ${task}`)
  }
}

parentPort?.on('message', (request: MainWorkerRequest) => {
  void (async () => {
    try {
      const result = await handleTask(request.task, request.payload)
      reply({ id: request.id, ok: true, result })
    } catch (err) {
      reply({
        id: request.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
})
