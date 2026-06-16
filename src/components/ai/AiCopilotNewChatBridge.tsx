import { useCallback, useEffect } from 'react'
import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2'
import { devError } from '../../../electron/shared/dev-log'
import { createAiCopilotThreadId } from '@/lib/ai-copilot-thread'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'

/** 注册「新对话」处理：清空消息并切换 thread，不通过 CopilotSidebar 的 threadId prop 控制。 */
export function AiCopilotNewChatBridge() {
  const registerNewChatHandler = useAiSidebarStore((s) => s.registerNewChatHandler)
  const unregisterNewChatHandler = useAiSidebarStore((s) => s.unregisterNewChatHandler)
  const { agent } = useAgent()
  const { copilotkit } = useCopilotKit()

  const startNewChat = useCallback(async () => {
    if (agent.isRunning) agent.abortRun()
    agent.setMessages([])
    agent.threadId = createAiCopilotThreadId()
    try {
      await copilotkit.connectAgent({ agent })
    } catch (error) {
      devError('AiCopilotNewChatBridge: connectAgent failed', error)
    }
  }, [agent, copilotkit])

  useEffect(() => {
    registerNewChatHandler(startNewChat)
    return unregisterNewChatHandler
  }, [registerNewChatHandler, unregisterNewChatHandler, startNewChat])

  return null
}
