import { containsVaultReference, listVaultReferenceNames } from './vault-reference'
import { devError } from './dev-log'

/** 本文件会被渲染进程打包，勿导入 `electron/app-log` 等 Node 专用模块 */

export type AiProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'openai-compatible'

export interface AiRuntimeConfig {
  enabled: boolean
  port: number
  provider: AiProvider
  model: string
  baseUrl: string
  apiKey: string
}

export const DEFAULT_AI_RUNTIME_PORT = 6173
export const MIN_AI_RUNTIME_PORT = 1024
export const MAX_AI_RUNTIME_PORT = 65535

export const AI_PROVIDERS: AiProvider[] = [
  'openai',
  'anthropic',
  'deepseek',
  'ollama',
  'openai-compatible',
]

export const AI_PROVIDER_DEFAULT_BASE_URL: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://127.0.0.1:11434/v1',
  'openai-compatible': '',
}

export const AI_PROVIDER_MODELS: Record<AiProvider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5', 'claude-3-5-haiku', 'claude-opus-4'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  ollama: ['llama3.2', 'qwen2.5', 'mistral', 'deepseek-r1'],
  'openai-compatible': ['gpt-4o', 'gpt-4o-mini', 'qwen-plus', 'qwen-max', 'deepseek-chat'],
}

export const DEFAULT_AI_PROVIDER: AiProvider = 'openai'
export const DEFAULT_AI_MODEL = AI_PROVIDER_MODELS[DEFAULT_AI_PROVIDER][0]

export function normalizeAiProvider(value: unknown): AiProvider {
  return AI_PROVIDERS.includes(value as AiProvider) ? (value as AiProvider) : DEFAULT_AI_PROVIDER
}

export function isAiPresetModel(provider: AiProvider, model: string): boolean {
  return AI_PROVIDER_MODELS[provider].includes(model)
}

export function normalizeAiModel(provider: AiProvider, value: unknown): string {
  const models = AI_PROVIDER_MODELS[provider]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return models[0]
}

export function normalizeAiBaseUrl(provider: AiProvider, value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) return trimmed.replace(/\/+$/, '')
  }
  return AI_PROVIDER_DEFAULT_BASE_URL[provider]
}

export function normalizeAiApiKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeAiRuntimePort(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_AI_RUNTIME_PORT
  return Math.min(MAX_AI_RUNTIME_PORT, Math.max(MIN_AI_RUNTIME_PORT, Math.round(n)))
}

export function aiProviderNeedsApiKey(provider: AiProvider): boolean {
  return provider !== 'ollama'
}

export function aiProviderUsesOpenAiApi(provider: AiProvider): boolean {
  return provider !== 'anthropic'
}

/** 解析 Vault 引用后的 API Key 是否可用（明文或 ${VAR} 解析结果均可） */
export function isAiApiKeyConfigured(
  config: Pick<AiRuntimeConfig, 'provider' | 'apiKey'>,
): boolean {
  if (!aiProviderNeedsApiKey(config.provider)) return true
  const key = config.apiKey.trim()
  if (!key || containsVaultReference(key)) return false
  return true
}

export function isAiRuntimeConfigured(
  config: Pick<AiRuntimeConfig, 'provider' | 'apiKey' | 'baseUrl'>,
): boolean {
  if (!config.baseUrl.trim()) return false
  return isAiApiKeyConfigured(config)
}

export function resolveAiRuntimeConfig(
  config: AiRuntimeConfig,
  resolveText: (text: string) => string,
): AiRuntimeConfig {
  return {
    ...config,
    apiKey: resolveText(config.apiKey).trim(),
  }
}

export function warnIfAiApiKeyUnresolved(
  storedApiKey: string,
  resolvedApiKey: string,
  provider: AiProvider,
): void {
  if (!aiProviderNeedsApiKey(provider)) return
  const key = resolvedApiKey.trim()
  if (key && !containsVaultReference(key)) return
  const refs = listVaultReferenceNames(storedApiKey)
  if (refs.length > 0) {
    devError(
      '[NioZy][Copilot] AI API Key vault reference could not be resolved:',
      refs,
    )
    return
  }
  if (!key) {
    devError('[NioZy][Copilot] AI API Key is empty after resolving vault references')
  }
}

/** 避免将未解析的 ${VAR} 当作 API Key 发给上游 */
export function sanitizeResolvedAiRuntimeConfig(
  storedApiKey: string,
  config: AiRuntimeConfig,
): AiRuntimeConfig {
  if (!aiProviderNeedsApiKey(config.provider)) return config
  const key = config.apiKey.trim()
  if (key && !containsVaultReference(key)) return config
  warnIfAiApiKeyUnresolved(storedApiKey, key, config.provider)
  return { ...config, apiKey: '' }
}

export function buildAiRuntimeConfig(ai: {
  aiSidebarEnabled?: boolean
  aiRuntimePort?: unknown
  aiProvider?: unknown
  aiModel?: unknown
  aiBaseUrl?: unknown
  aiApiKey?: unknown
  openAiApiKey?: unknown
}): AiRuntimeConfig {
  const provider = normalizeAiProvider(ai.aiProvider)
  const legacyKey = normalizeAiApiKey(ai.openAiApiKey)
  const apiKey = normalizeAiApiKey(ai.aiApiKey) || legacyKey
  return {
    enabled: ai.aiSidebarEnabled === true,
    port: normalizeAiRuntimePort(ai.aiRuntimePort),
    provider,
    model: normalizeAiModel(provider, ai.aiModel),
    baseUrl: normalizeAiBaseUrl(provider, ai.aiBaseUrl),
    apiKey,
  }
}
