import {
  DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  normalizeAiSidebarWidthPreset,
  type AiSidebarWidthPreset,
} from './ai-sidebar-width'
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_RUNTIME_PORT,
  normalizeAiApiKey,
  normalizeAiBaseUrl,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeAiRuntimePort,
  type AiProvider,
} from './ai-provider-settings'
import { normalizeAiRuleStates, type AiRuleStates } from './ai-context-types'

export interface AiSettings {
  /** 开启 AI 对话边栏 */
  aiSidebarEnabled: boolean
  /** AI 边栏支持附加本地图片/文件 */
  aiAttachmentsEnabled: boolean
  /** AI 边栏宽度预设 */
  aiSidebarWidth: AiSidebarWidthPreset
  /** 本机 Copilot Runtime 监听端口 */
  aiRuntimePort: number
  /** AI 提供商 */
  aiProvider: AiProvider
  /** AI 模型 */
  aiModel: string
  /** AI API Base URL */
  aiBaseUrl: string
  /** AI API Key；可为明文或存储库引用如 ${OPENAI_API_KEY} */
  aiApiKey: string
  /** 已启用规则 id → true；未列入或 false 表示不注入对话上下文 */
  aiRuleStates: AiRuleStates
  /** @deprecated 迁移至 aiApiKey */
  openAiApiKey?: string
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  aiSidebarEnabled: false,
  aiAttachmentsEnabled: false,
  aiSidebarWidth: DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  aiRuntimePort: DEFAULT_AI_RUNTIME_PORT,
  aiProvider: DEFAULT_AI_PROVIDER,
  aiModel: DEFAULT_AI_MODEL,
  aiBaseUrl: normalizeAiBaseUrl(DEFAULT_AI_PROVIDER, undefined),
  aiApiKey: '',
  aiRuleStates: {},
}

export function normalizeAiSettings(raw: unknown): AiSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const provider = normalizeAiProvider(o.aiProvider)
  const legacyApiKey = normalizeAiApiKey(o.openAiApiKey)
  const aiApiKey = normalizeAiApiKey(o.aiApiKey) || legacyApiKey
  return {
    aiSidebarEnabled: o.aiSidebarEnabled === true,
    aiAttachmentsEnabled: o.aiAttachmentsEnabled === true,
    aiSidebarWidth: normalizeAiSidebarWidthPreset(o.aiSidebarWidth),
    aiRuntimePort: normalizeAiRuntimePort(o.aiRuntimePort),
    aiProvider: provider,
    aiModel: normalizeAiModel(provider, o.aiModel),
    aiBaseUrl: normalizeAiBaseUrl(provider, o.aiBaseUrl),
    aiApiKey,
    aiRuleStates: normalizeAiRuleStates(o.aiRuleStates),
  }
}

const LEGACY_AI_KEYS = [
  'aiSidebarEnabled',
  'aiAttachmentsEnabled',
  'aiSidebarWidth',
  'aiRuntimePort',
  'aiProvider',
  'aiModel',
  'aiBaseUrl',
  'aiApiKey',
  'aiRuleStates',
  'openAiApiKey',
] as const

export function isAiSettingsEmpty(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return !LEGACY_AI_KEYS.some((key) => key in (raw as Record<string, unknown>))
}

export function extractLegacyAiSettings(raw: unknown): Partial<AiSettings> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const extracted = Object.fromEntries(
    LEGACY_AI_KEYS.filter((key) => key in source).map((key) => [key, source[key]]),
  )
  return Object.keys(extracted).length > 0 ? (extracted as Partial<AiSettings>) : null
}

export {
  buildAiRuntimeConfig,
  resolveAiRuntimeConfig,
  sanitizeResolvedAiRuntimeConfig,
  warnIfAiApiKeyUnresolved,
  type AiProvider,
} from './ai-provider-settings'

export { normalizeAiRuleStates, type AiRuleStates } from './ai-context-types'
export type { AiRuleSummary, AiSkillSummary, AiChatContextPayload } from './ai-context-types'

export {
  AI_SIDEBAR_WIDTH_PRESETS,
  AI_SIDEBAR_WIDTH_PX,
  DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  normalizeAiSidebarWidthPreset,
  resolveAiSidebarWidthPx,
  type AiSidebarWidthPreset,
} from './ai-sidebar-width'
