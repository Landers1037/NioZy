import type { ClaudeCodeSessionEntry, ProjectSessionGroup } from './session-types'

export function parseClaudeCodeHistoryLine(line: string): ClaudeCodeSessionEntry | null {
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

export function parseClaudeCodeHistoryContent(content: string): ClaudeCodeSessionEntry[] {
  const sessionMap = new Map<string, ClaudeCodeSessionEntry>()
  for (const line of content.split('\n')) {
    const entry = parseClaudeCodeHistoryLine(line)
    if (!entry) continue
    const existing = sessionMap.get(entry.sessionId)
    if (!existing || entry.timestamp >= existing.timestamp) {
      sessionMap.set(entry.sessionId, entry)
    }
  }
  return Array.from(sessionMap.values())
}

export function groupSessionsByProject(sessions: ClaudeCodeSessionEntry[]): ProjectSessionGroup[] {
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

export function normalizeOpenCodeTimestamp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value < 1_000_000_000_000 ? value * 1000 : value
}

export interface OpenCodeSessionRow {
  id: string
  directory: string
  title: string
  time_created: number
}

export function parseOpenCodeSessionRows(
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

export function openCodeRowsToSessions(rows: OpenCodeSessionRow[]): ClaudeCodeSessionEntry[] {
  return rows
    .filter((row) => row.id.trim())
    .map((row) => ({
      sessionId: row.id,
      project: row.directory,
      display: row.title,
      timestamp: normalizeOpenCodeTimestamp(row.time_created),
    }))
}
