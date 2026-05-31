import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Eraser, History, Search } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getElectronAPI } from '@/lib/electron-client'
import { useP2pChatStore } from '@/stores/p2p-chat-store'
import type { P2pChatMessage } from '../../../electron/shared/p2p-types'
import { cn } from '@/lib/utils'

interface ChatHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  peerName: string
}

function matchesQuery(message: P2pChatMessage, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (message.text?.toLowerCase().includes(q)) return true
  if (message.fileName?.toLowerCase().includes(q)) return true
  if (message.mimeType?.toLowerCase().includes(q)) return true
  return false
}

function HistoryMessageRow({ message }: { message: P2pChatMessage }) {
  const { t } = useTranslation()
  const outbound = message.direction === 'outbound'

  return (
    <div
      className={cn(
        'rounded-md border border-border px-3 py-2 text-sm',
        outbound ? 'bg-primary/5' : 'bg-muted/50',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{outbound ? t('chat.historyOutbound') : t('chat.historyInbound')}</span>
        <time>{new Date(message.sentAt).toLocaleString()}</time>
      </div>
      {message.type === 'text' ? (
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      ) : (
        <p className="break-words">
          [{message.type === 'image' ? t('chat.attachImage') : t('chat.attachFile')}] {message.fileName}
          {message.fileSize ? ` (${formatBytes(message.fileSize)})` : ''}
        </p>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatHistoryDialog({
  open,
  onOpenChange,
  sessionId,
  peerName,
}: ChatHistoryDialogProps) {
  const { t } = useTranslation()
  const setMessages = useP2pChatStore((s) => s.setMessages)
  const clearMessages = useP2pChatStore((s) => s.clearMessages)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setLocalMessages] = useState<P2pChatMessage[]>([])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    setLoading(true)
    void getElectronAPI()
      .p2p.getFullHistory(sessionId)
      .then((result) => {
        if (result.ok) {
          setLocalMessages(result.messages)
          setMessages(sessionId, result.messages)
        } else {
          toast.error(result.error ?? t('chat.historyLoadFailed'))
        }
      })
      .catch(() => toast.error(t('chat.historyLoadFailed')))
      .finally(() => setLoading(false))
  }, [open, sessionId, setMessages, t])

  const filtered = useMemo(
    () => messages.filter((message) => matchesQuery(message, query)),
    [messages, query],
  )

  const handleClear = async () => {
    setClearing(true)
    try {
      const result = await getElectronAPI().p2p.clearHistory(sessionId)
      if (!result.ok) {
        toast.error(result.error ?? t('chat.historyClearFailed'))
        return
      }
      setLocalMessages([])
      clearMessages(sessionId)
      setMessages(sessionId, [])
      toast.success(t('chat.historyCleared'))
      setClearConfirmOpen(false)
      onOpenChange(false)
    } catch {
      toast.error(t('chat.historyClearFailed'))
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5" />
              {t('chat.historyTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('chat.historyDesc', { name: peerName, count: messages.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b border-border px-6 py-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('chat.historySearchPlaceholder')}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loading || clearing || messages.length === 0}
              onClick={() => setClearConfirmOpen(true)}
            >
              <Eraser className="size-4" />
              {t('chat.historyClear')}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground">{t('chat.historyLoading')}</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                {messages.length === 0 ? t('chat.historyEmpty') : t('chat.historyNoResults')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((message) => (
                  <HistoryMessageRow key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border px-6 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.historyClearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.historyClearConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleClear()
              }}
            >
              {t('chat.historyClearConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
