import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { History, ImageIcon, Paperclip, Send, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getElectronAPI } from '@/lib/electron-client'
import { useP2pChatStore } from '@/stores/p2p-chat-store'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { ChatHistoryDialog } from '@/components/chat/ChatHistoryDialog'

export function ChatConversation() {
  const { t } = useTranslation()
  const sessions = useP2pChatStore((s) => s.sessions)
  const activeSessionId = useP2pChatStore((s) => s.activeSessionId)
  const messagesBySession = useP2pChatStore((s) => s.messagesBySession)
  const fileProgress = useP2pChatStore((s) => s.fileProgress)
  const removeSession = useP2pChatStore((s) => s.removeSession)
  const upsertSession = useP2pChatStore((s) => s.upsertSession)
  const setActiveSessionId = useP2pChatStore((s) => s.setActiveSessionId)
  const clearMessages = useP2pChatStore((s) => s.clearMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeSession = sessions.find((s) => s.sessionId === activeSessionId)
  const messages = activeSessionId ? (messagesBySession[activeSessionId] ?? []) : []
  const isOnline = activeSession?.status === 'connected'

  if (!activeSession) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('chat.selectSession')}
      </div>
    )
  }

  const peerName =
    activeSession.peer.displayName || activeSession.peer.hostname || activeSession.peer.ip

  const handleSend = async () => {
    if (!isOnline) return
    const text = draft.trim()
    if (!text || !activeSessionId) return
    setSending(true)
    const result = await getElectronAPI().p2p.sendText(activeSessionId, text)
    setSending(false)
    if (!result.ok) {
      toast.error(result.error ?? t('toast.p2pSendFailed'))
      return
    }
    setDraft('')
  }

  const handlePickFile = async (imagesOnly: boolean) => {
    if (!isOnline || !activeSessionId) return
    const result = await getElectronAPI().p2p.pickAndSendFile(activeSessionId, imagesOnly)
    if (result.canceled) return
    if (!result.ok) toast.error(result.error ?? t('toast.p2pSendFailed'))
  }

  const handleDisconnect = async () => {
    if (!activeSessionId) return
    const result = await getElectronAPI().p2p.disconnect(activeSessionId)
    if (!result.ok) {
      toast.error(result.error ?? t('toast.p2pConnectFailed'))
      return
    }
    upsertSession({ ...activeSession, status: 'disconnected' })
  }

  const handleDeleteConversation = async () => {
    if (!activeSessionId) return
    setDeleting(true)
    const result = await getElectronAPI().p2p.removeConversation(activeSessionId)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error ?? t('chat.deleteConversationFailed'))
      return
    }
    clearMessages(activeSessionId)
    removeSession(activeSessionId)
    setActiveSessionId(null)
    setDeleteOpen(false)
    toast.success(t('chat.conversationDeleted'))
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{peerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {activeSession.peer.ip}:{activeSession.peer.port} ·{' '}
            {isOnline ? t('chat.connected') : t('chat.offline')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOnline && (
            <Button type="button" variant="outline" size="sm" onClick={() => void handleDisconnect()}>
              {t('chat.disconnect')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            title={t('chat.deleteConversation')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <ChatMessageList
        messages={messages}
        fileProgress={fileProgress}
        emptyHint={t('chat.noMessagesYet')}
      />

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!isOnline}
          onClick={() => void handlePickFile(false)}
          title={t('chat.attachFile')}
        >
          <Paperclip className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!isOnline}
          onClick={() => void handlePickFile(true)}
          title={t('chat.attachImage')}
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setHistoryOpen(true)}
          title={t('chat.historyTitle')}
        >
          <History className="size-4" />
        </Button>
        <Input
          className="min-w-0 flex-1"
          value={draft}
          disabled={!isOnline}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isOnline ? t('chat.inputPlaceholder') : t('chat.offlineInputPlaceholder')}
          onKeyDown={(e) => {
            if (!isOnline) return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={!isOnline || sending || !draft.trim()}
          onClick={() => void handleSend()}
        >
          <Send className="size-4" />
        </Button>
      </div>

      <ChatHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        sessionId={activeSession.sessionId}
        peerName={peerName}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteConversationConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('chat.deleteConversationConfirmDesc', { name: peerName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDeleteConversation()}>
              {t('chat.deleteConversationConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
