import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { DEFAULT_CLAUDE_CODE_HISTORY_PATH, DEFAULT_OPEN_CODE_DB_PATH } from './shared/session-settings'
import type {
  ListClaudeCodeSessionsResult,
  ListOpenCodeSessionsResult,
} from './shared/session-types'
import { runMainWorkerTask } from './workers/main-worker-pool'
import type {
  SessionParseClaudeCodeResult,
  SessionParseOpenCodePayload,
} from './workers/main-worker-types'

/** 将 %USERPROFILE% 等占位符展开为实际路径（仅主进程） */
function expandSessionPath(path: string): string {
  const home = process.env.USERPROFILE || homedir()
  return path.replace(/%USERPROFILE%/gi, home).replace(/^~(?=\/|\\|$)/, home)
}

export async function listClaudeCodeSessions(
  historyPath: string = DEFAULT_CLAUDE_CODE_HISTORY_PATH,
): Promise<ListClaudeCodeSessionsResult> {
  const resolved = expandSessionPath(historyPath)
  if (!existsSync(resolved)) {
    return { ok: false, error: 'FILE_NOT_FOUND' }
  }

  try {
    const content = await readFile(resolved, 'utf8')
    const { groups } = await runMainWorkerTask<SessionParseClaudeCodeResult>(
      'session:parseClaudeCode',
      { content },
    )
    return { ok: true, groups }
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
}

export async function listOpenCodeSessions(
  dbPath: string = DEFAULT_OPEN_CODE_DB_PATH,
): Promise<ListOpenCodeSessionsResult> {
  const resolved = expandSessionPath(dbPath)
  if (!existsSync(resolved)) {
    return { ok: false, error: 'FILE_NOT_FOUND' }
  }

  try {
    const dbBuffer = await readFile(resolved)
    const { groups } = await runMainWorkerTask<SessionParseClaudeCodeResult>(
      'session:parseOpenCode',
      { dbBuffer: new Uint8Array(dbBuffer) } satisfies SessionParseOpenCodePayload,
    )
    return { ok: true, groups }
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
}
