import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { DEFAULT_CLAUDE_CODE_HISTORY_PATH } from './shared/session-settings'
import type {
  ClaudeCodeSessionEntry,
  ListClaudeCodeSessionsResult,
  ProjectSessionGroup,
} from './shared/session-types'

/** 将 %USERPROFILE% 等占位符展开为实际路径（仅主进程） */
function expandSessionPath(path: string): string {
  const home = process.env.USERPROFILE || homedir()
  return path.replace(/%USERPROFILE%/gi, home).replace(/^~(?=\/|\\|$)/, home)
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

    const byProject = new Map<string, ClaudeCodeSessionEntry[]>()
    for (const session of sessionMap.values()) {
      const key = session.project || ''
      const list = byProject.get(key) ?? []
      list.push(session)
      byProject.set(key, list)
    }

    const groups: ProjectSessionGroup[] = Array.from(byProject.entries())
      .map(([project, sessions]) => ({
        project,
        sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
      }))
      .sort((a, b) => {
        const aMax = a.sessions[0]?.timestamp ?? 0
        const bMax = b.sessions[0]?.timestamp ?? 0
        return bMax - aMax
      })

    return { ok: true, groups }
  } catch {
    return { ok: false, error: 'READ_FAILED' }
  }
}
