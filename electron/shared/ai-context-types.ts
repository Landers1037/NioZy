export const AI_RULE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export interface AiRuleSummary {
  id: string
  enabled: boolean
}

export interface AiSkillSummary {
  id: string
  name: string
  description?: string
}

export interface AiChatContextPayload {
  rules: Array<{ id: string; content: string }>
  skills: Array<{ id: string; name: string; content: string }>
}

export type AiRuleStates = Record<string, boolean>

export function normalizeAiRuleStates(raw: unknown): AiRuleStates {
  if (!raw || typeof raw !== 'object') return {}
  const out: AiRuleStates = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!AI_RULE_ID_PATTERN.test(key)) continue
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

export function sanitizeAiRuleId(raw: unknown): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed || !AI_RULE_ID_PATTERN.test(trimmed)) return null
  return trimmed
}
