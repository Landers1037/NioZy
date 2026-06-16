import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CopilotKitCoreErrorCode } from '@copilotkit/core'
import { useCopilotKit } from '@copilotkit/react-core/v2'
import { shouldToastAiCopilotApiError, toastAiCopilotApiError } from '@/lib/ai-copilot-error-toast'

/** 监听 CopilotKit 对话 API 失败，在前台弹出 Toast。 */
export function AiCopilotErrorBridge() {
  const { t } = useTranslation()
  const { copilotkit } = useCopilotKit()

  useEffect(() => {
    const subscription = copilotkit.subscribe({
      onError: (event) => {
        if (!shouldToastAiCopilotApiError(event.code)) return
        toastAiCopilotApiError(event, t)
      },
    })
    return () => subscription.unsubscribe()
  }, [copilotkit, t])

  return null
}
