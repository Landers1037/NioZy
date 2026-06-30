export const DEFAULT_NIOZY_AGENT_MAX_TOKENS = 4096

export interface AgentSettings {
  /** 开启后在新建连接中显示 NioZy Agent */
  niozyAgentEnabled: boolean
  /** NioZy Agent 日志级别 */
  niozyAgentLogLevel: 'INFO' | 'ERROR' | 'DEBUG'
  /** 开启后写入日志文件 */
  niozyAgentLogToFile: boolean
  /** NioZy Agent 日志文件路径 */
  niozyAgentLogFile: string
  /** NioZy Agent 单次请求最大输出 token 数 */
  niozyAgentMaxTokens: number
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  niozyAgentEnabled: false,
  niozyAgentLogLevel: 'INFO',
  niozyAgentLogToFile: false,
  niozyAgentLogFile: '',
  niozyAgentMaxTokens: DEFAULT_NIOZY_AGENT_MAX_TOKENS,
}

export const NIOZY_AGENT_LOG_LEVELS = ['INFO', 'ERROR', 'DEBUG'] as const

export function normalizeNiozyAgentLogLevel(
  value: unknown,
): AgentSettings['niozyAgentLogLevel'] {
  return NIOZY_AGENT_LOG_LEVELS.includes(value as AgentSettings['niozyAgentLogLevel'])
    ? (value as AgentSettings['niozyAgentLogLevel'])
    : 'INFO'
}

export function normalizeNiozyAgentLogFile(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeNiozyAgentMaxTokens(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_NIOZY_AGENT_MAX_TOKENS
  return Math.max(1, Math.round(n))
}

export function normalizeAgentSettings(raw: unknown): AgentSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    niozyAgentEnabled: o.niozyAgentEnabled === true,
    niozyAgentLogLevel: normalizeNiozyAgentLogLevel(o.niozyAgentLogLevel),
    niozyAgentLogToFile: o.niozyAgentLogToFile === true,
    niozyAgentLogFile: normalizeNiozyAgentLogFile(o.niozyAgentLogFile),
    niozyAgentMaxTokens: normalizeNiozyAgentMaxTokens(o.niozyAgentMaxTokens),
  }
}

const LEGACY_AGENT_KEYS = [
  'niozyAgentEnabled',
  'niozyAgentLogLevel',
  'niozyAgentLogToFile',
  'niozyAgentLogFile',
  'niozyAgentMaxTokens',
] as const

export function isAgentSettingsEmpty(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return !LEGACY_AGENT_KEYS.some((key) => key in (raw as Record<string, unknown>))
}

export function extractLegacyAgentSettings(raw: unknown): Partial<AgentSettings> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const extracted = Object.fromEntries(
    LEGACY_AGENT_KEYS.filter((key) => key in source).map((key) => [key, source[key]]),
  )
  return Object.keys(extracted).length > 0
    ? (extracted as Partial<AgentSettings>)
    : null
}
