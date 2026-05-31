import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { useP2pIpcSync } from '@/hooks/useP2pIpcSync'
import { ChatSessionList } from '@/components/chat/ChatSessionList'
import { ChatConversation } from '@/components/chat/ChatConversation'
import { ChatRequestDialog } from '@/components/chat/ChatRequestDialog'

export function ChatPanel() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const enabled = settings?.p2p.enabled === true
  const port = settings?.p2p.port ?? 6869

  useP2pIpcSync(enabled)

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('chat.disabled')}
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSessionList port={port} />
      <ChatConversation />
      <ChatRequestDialog />
    </div>
  )
}
