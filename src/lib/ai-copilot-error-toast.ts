import { CopilotKitCoreErrorCode } from '@copilotkit/core'
import { toast } from 'sonner'
import type { TFunction } from 'i18next'
import i18n from '@/lib/i18n'

const TOAST_ID = 'ai-sidebar-api-error'

const AI_SIDEBAR_API_ERROR_CODES = new Set<string>([
  CopilotKitCoreErrorCode.AGENT_CONNECT_FAILED,
  CopilotKitCoreErrorCode.AGENT_RUN_FAILED,
  CopilotKitCoreErrorCode.AGENT_RUN_FAILED_EVENT,
  CopilotKitCoreErrorCode.AGENT_RUN_ERROR_EVENT,
])

export type AiCopilotApiErrorEvent = {
  error: Error
  code?: string
  context?: Record<string, unknown>
}

export function shouldToastAiCopilotApiError(code: string): boolean {
  return AI_SIDEBAR_API_ERROR_CODES.has(code)
}

function isTimeoutLike(error: Error): boolean {
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  const message = error.message.toLowerCase()
  return /timeout|timed out|etimedout|econnaborted/i.test(message)
}

function formatErrorDetail(error: Error): string | null {
  const message = error.message.trim()
  if (!message || /^network error$/i.test(message)) return null
  return message
}

export function toastAiCopilotApiError(event: AiCopilotApiErrorEvent, t: TFunction): void {
  const detail = formatErrorDetail(event.error)
  const isTimeout =
    isTimeoutLike(event.error) || event.code === CopilotKitCoreErrorCode.AGENT_CONNECT_FAILED
  const base = isTimeout ? t('toast.aiSidebarRequestTimeout') : t('toast.aiSidebarRequestFailed')
  const sep = i18n.language === 'zh' ? '：' : ': '
  const message = detail ? `${base}${sep}${detail}` : base
  toast.error(message, { id: TOAST_ID })
}
