import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { homedir } from 'os'
import { dirname, join } from 'path'
import initSqlJs from 'sql.js'
import {
  DEFAULT_CLAUDE_CODE_HISTORY_PATH,
  DEFAULT_OPEN_CODE_DB_PATH,
} from './shared/session-settings'
import type {
  ClaudeCodeSessionEntry,
  ListClaudeCodeSessionsResult,
  ListOpenCodeSessionsResult,
  ProjectSessionGroup,
} from './shared/session-types'

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

/** 将 %USERPROFILE% 等占位符展开为实际路径（仅主进程） */
function expandSessionPath(path: string): string {
  const home = process.env.USERPROFILE || homedir()
  return path.replace(/%USERPROFILE%/gi, home).replace(/^~(?=\/|\\|$)/, home)
}

function normalizeTimestamp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function groupSessionsByProject(sessions: ClaudeCodeSessionEntry[]): ProjectSessionGroup[] {
  const byProject = new Map<string, ClaudeCodeSessionEntry[]>()
  for (const session of sessions) {
    const key = session.project || ''
    const list = byProject.get(key) ?? []
    list.push(session)
    byProject.set(key, list)
  }

  return Array.from(byProject.entries())
    .map(([project, projectSessions]) => ({
      project,
      sessions: projectSessions.sort((a, b) => b.timestamp - a.timestamp),
    }))
    .sort((a, b) => {
      const aMax = a.sessions[0]?.timestamp ?? 0
      const bMax = b.sessions[0]?.timestamp ?? 0
      return bMax - aMax
    })
}

function parseClaudeCodeHistoryLine(line: string): ClaudeCodeSessionEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>
    const sessionId = typeof obj.sessionId === 'string' ? obj.sessionId.trim() : ''
    if (!sessionId) return null
    return {
      sessionId,
      project: typeof obj.project === 'string' ? obj.project : '',
      display: typeof obj.display === 'string' ? obj.display : '',
      timestamp: typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp)
        ? obj.timestamp
        : 0,
    }
  } catch {
    return null
  }
}

export function listClaudeCodeSessions(
  historyPath: string = DEFAULT_CLAUDE_CODE_HISTORY_PATH,
): ListClaudeCodeSessionsResult {
  const resolved = expandSessionPath(historyPath)
  if (!existsSync(resolved)) {
    return { ok: false, error: 'FILE_NOT_FOUND' }
  }

  try {
    const content = readFileSync(resolved, 'utf8')
    const sessionMap = new Map<string, ClaudeCodeSessionEntry>()

    for (const line of content.split('\n')) {
      const entry = parseClaudeCodeHistoryLine(line)
      if (!entry) continue
      const existing = sessionMap.get(entry.sessionId)
      if (!existing || entry.timestamp >= existing.timestamp) {
        sessionMap.set(entry.sessionId, entry)
      }
    }

    return { ok: true, groups: groupSessionsByProject(Array.from(sessionMap.values())) }
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
}

interface OpenCodeSessionRow {
  id: string
  directory: string
  title: string
  time_created: number
}

function parseOpenCodeSessionRows(
  result: { columns: string[]; values: unknown[][] } | undefined,
): OpenCodeSessionRow[] {
  if (!result) return []
  const indexByColumn = new Map(result.columns.map((column, index) => [column, index]))
  const idIndex = indexByColumn.get('id')
  const directoryIndex = indexByColumn.get('directory')
  const titleIndex = indexByColumn.get('title')
  const timeCreatedIndex = indexByColumn.get('time_created')
  if (
    idIndex === undefined ||
    directoryIndex === undefined ||
    titleIndex === undefined ||
    timeCreatedIndex === undefined
  ) {
    return []
  }

  return result.values.map((row) => ({
    id: String(row[idIndex] ?? ''),
    directory: String(row[directoryIndex] ?? ''),
    title: String(row[titleIndex] ?? ''),
    time_created: Number(row[timeCreatedIndex] ?? 0),
  }))
}

export async function listOpenCodeSessions(
  dbPath: string = DEFAULT_OPEN_CODE_DB_PATH,
): Promise<ListOpenCodeSessionsResult> {
  const resolved = expandSessionPath(dbPath)
  if (!existsSync(resolved)) {
    return { ok: false, error: 'FILE_NOT_FOUND' }
  }

  try {
    const SQL = await getSql()
    const db = new SQL.Database(readFileSync(resolved))
    try {
      const queryResult = db.exec(
        `SELECT id, directory, title, time_created
         FROM session
         WHERE id IS NOT NULL AND id != ''
         ORDER BY time_created DESC`,
      )
      const rows = parseOpenCodeSessionRows(queryResult[0])
      const sessions: ClaudeCodeSessionEntry[] = rows
        .filter((row) => row.id.trim())
        .map((row) => ({
          sessionId: row.id,
          project: row.directory,
          display: row.title,
          timestamp: normalizeTimestamp(row.time_created),
        }))

      return { ok: true, groups: groupSessionsByProject(sessions) }
    } finally {
      db.close()
    }
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
}
