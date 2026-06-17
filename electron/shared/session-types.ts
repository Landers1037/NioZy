export type SessionTool = 'claudeCode' | 'openCode' | 'piAgent'

export interface ClaudeCodeSessionEntry {
  display: string
  timestamp: number
  project: string
  sessionId: string
}

export interface ProjectSessionGroup {
  project: string
  sessions: ClaudeCodeSessionEntry[]
}

export type ListClaudeCodeSessionsError = 'FILE_NOT_FOUND' | 'READ_FAILED'

export type ListClaudeCodeSessionsResult =
  | { ok: true; groups: ProjectSessionGroup[] }
  | { ok: false; error: ListClaudeCodeSessionsError }
