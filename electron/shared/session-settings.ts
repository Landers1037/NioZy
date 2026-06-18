export const DEFAULT_CLAUDE_CODE_HISTORY_PATH = '%USERPROFILE%/.claude/history.jsonl'

export interface SessionSettings {
  /** 开启后在侧栏显示「会话管理」入口 */
  agentSessionEnabled: boolean
  /** 开启 Claude Code 会话解析与管理 */
  claudeCodeSessionEnabled: boolean
  /** Claude Code 会话列表 JSONL 路径 */
  claudeCodeHistoryPath: string
  /** 开启 Open Code 会话管理（暂未实现） */
  openCodeSessionEnabled: boolean
  /** 开启 Pi Agent 会话管理（暂未实现） */
  piAgentSessionEnabled: boolean
  /** 开启 Cline 会话管理（暂未实现） */
  clineSessionEnabled: boolean
  /** 开启 Codex 会话管理（暂未实现） */
  codexSessionEnabled: boolean
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  agentSessionEnabled: false,
  claudeCodeSessionEnabled: false,
  claudeCodeHistoryPath: DEFAULT_CLAUDE_CODE_HISTORY_PATH,
  openCodeSessionEnabled: false,
  piAgentSessionEnabled: false,
  clineSessionEnabled: false,
  codexSessionEnabled: false,
}

export function normalizeSessionSettings(value: unknown): SessionSettings {
  const v = value && typeof value === 'object' ? (value as Partial<SessionSettings>) : {}
  return {
    agentSessionEnabled: v.agentSessionEnabled === true,
    claudeCodeSessionEnabled: v.claudeCodeSessionEnabled === true,
    claudeCodeHistoryPath:
      typeof v.claudeCodeHistoryPath === 'string' && v.claudeCodeHistoryPath.trim()
        ? v.claudeCodeHistoryPath.trim()
        : DEFAULT_SESSION_SETTINGS.claudeCodeHistoryPath,
    openCodeSessionEnabled: v.openCodeSessionEnabled === true,
    piAgentSessionEnabled: v.piAgentSessionEnabled === true,
    clineSessionEnabled: v.clineSessionEnabled === true,
    codexSessionEnabled: v.codexSessionEnabled === true,
  }
}
