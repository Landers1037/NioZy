import { useTranslation } from 'react-i18next'
import { SquarePen } from 'lucide-react'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'

export function AiSidebarNewChatButton() {
  const { t } = useTranslation()
  const requestNewChat = useAiSidebarStore((s) => s.requestNewChat)

  return (
    <button
      type="button"
      data-testid="ai-sidebar-new-chat-button"
      className="niozy-ai-new-chat-button"
      onClick={() => requestNewChat()}
      title={t('aiSidebar.newChat')}
      aria-label={t('aiSidebar.newChat')}
    >
      <SquarePen className="cpk:size-4" aria-hidden />
    </button>
  )
}
