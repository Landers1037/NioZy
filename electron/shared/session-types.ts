export type SessionTool = 'claudeCode' | 'openCode' | 'piAgent' | 'cline' | 'codex'

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

export type ListSessionsError = 'FILE_NOT_FOUND' | 'READ_FAILED'

export type ListClaudeCodeSessionsResult =
  | { ok: true; groups: ProjectSessionGroup[] }
  | { ok: false; error: ListSessionsError }

export type ListOpenCodeSessionsResult = ListClaudeCodeSessionsResult
