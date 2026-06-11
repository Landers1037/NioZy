import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Plus, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getElectronAPI } from '@/lib/electron-client'
import { useP2pChatStore } from '@/stores/p2p-chat-store'
import { cn } from '@/lib/utils'
import { DEFAULT_P2P_PORT, normalizeP2pPort } from '../../../electron/shared/p2p-settings'
import type { P2pOpenConversationResult, P2pPeerInfo, P2pSessionInfo } from '../../../electron/shared/p2p-types'

interface ChatSessionListProps {
  port: number
}

function sessionLabel(session: P2pSessionInfo): string {
  return session.peer.displayName || session.peer.hostname || session.peer.ip
}

interface SessionListItemProps {
  session: P2pSessionInfo
  active: boolean
  opening: boolean
  onOpen: () => void
  onOpenPanel: () => void
  onClosePanel: () => void
  onRemoveFromList: () => void
  onReconnect: () => void
}

function SessionListItem({
  session,
  active,
  opening,
  onOpen,
  onOpenPanel,
  onClosePanel,
  onRemoveFromList,
  onReconnect,
}: SessionListItemProps) {
  const { t } = useTranslation()
  const isOnline = session.status === 'connected'

  const row = (
    <button
      type="button"
      disabled={opening}
      className={cn(
        'mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
        active && 'bg-muted',
      )}
      onClick={onOpen}
    >
      <span className="flex items-center gap-2 truncate font-medium">
        {opening && <Loader2 className="size-3 shrink-0 animate-spin" />}
        {sessionLabel(session)}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {session.peer.ip}:{session.peer.port} ·{' '}
        {isOnline ? t('chat.connected') : t('chat.offline')}
      </span>
    </button>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpenPanel}>{t('chat.contextOpenSession')}</ContextMenuItem>
        <ContextMenuItem onSelect={onClosePanel}>{t('chat.contextCloseSession')}</ContextMenuItem>
        <ContextMenuItem onSelect={onReconnect}>{t('chat.contextReconnect')}</ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRemoveFromList}
        >
          {t('chat.contextRemoveFromList')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ChatSessionList({ port }: ChatSessionListProps) {
  const { t } = useTranslation()
  const peers = useP2pChatStore((s) => s.peers)
  const sessions = useP2pChatStore((s) => s.sessions)
  const activeSessionId = useP2pChatStore((s) => s.activeSessionId)
  const scanning = useP2pChatStore((s) => s.scanning)
  const setScanning = useP2pChatStore((s) => s.setScanning)
  const mergePeers = useP2pChatStore((s) => s.mergePeers)
  const setActiveSessionId = useP2pChatStore((s) => s.setActiveSessionId)
  const upsertSession = useP2pChatStore((s) => s.upsertSession)
  const removeSession = useP2pChatStore((s) => s.removeSession)
  const setMessages = useP2pChatStore((s) => s.setMessages)

  const [newOpen, setNewOpen] = useState(false)
  const [host, setHost] = useState('')
  const [connectPort, setConnectPort] = useState(String(port || DEFAULT_P2P_PORT))
  const [message, setMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null)
  const [handshakeRetry, setHandshakeRetry] = useState<{
    sessionId: string
    error?: string
  } | null>(null)
  const [retryingHandshake, setRetryingHandshake] = useState(false)

  useEffect(() => {
    setConnectPort(String(port || DEFAULT_P2P_PORT))
  }, [port])

  const loadHistory = async (sessionId: string) => {
    const result = await getElectronAPI().p2p.getHistory(sessionId)
    if (result.ok) setMessages(sessionId, result.messages)
  }

  const applyOpenConversationResult = (
    session: P2pSessionInfo,
    result: P2pOpenConversationResult,
  ): boolean => {
    if (result.session) upsertSession(result.session)
    if (result.ok && result.session?.status === 'connected') return true
    if (result.handshakeFailed) {
      setHandshakeRetry({ sessionId: session.sessionId, error: result.error })
      return true
    }
    if (!result.online) {
      toast.error(result.error ?? t('chat.peerUnreachable'))
      return false
    }
    if (!result.ok) {
      toast.error(result.error ?? t('toast.p2pConnectFailed'))
    }
    return false
  }

  const runOpenConversation = async (session: P2pSessionInfo) => {
    setOpeningSessionId(session.sessionId)
    try {
      const result = await getElectronAPI().p2p.openConversation(session.sessionId)
      return applyOpenConversationResult(session, result)
    } catch {
      upsertSession({ ...session, status: 'disconnected' })
      toast.error(t('toast.p2pConnectFailed'))
      return false
    } finally {
      setOpeningSessionId(null)
    }
  }

  const handleOpenConversation = async (session: P2pSessionInfo) => {
    setActiveSessionId(session.sessionId)
    await loadHistory(session.sessionId)

    if (session.status === 'connected') {
      upsertSession(session)
      return
    }

    await runOpenConversation(session)
  }

  const handleOpenPanel = async (session: P2pSessionInfo) => {
    if (activeSessionId === session.sessionId) return
    setActiveSessionId(session.sessionId)
    await loadHistory(session.sessionId)
  }

  const handleClosePanel = (session: P2pSessionInfo) => {
    if (activeSessionId === session.sessionId) setActiveSessionId(null)
  }

  const handleRemoveFromList = async (session: P2pSessionInfo) => {
    const result = await getElectronAPI().p2p.hideFromSidebar(session.sessionId)
    if (!result.ok) {
      toast.error(result.error ?? t('chat.removeFromListFailed'))
      return
    }
    removeSession(session.sessionId)
    if (activeSessionId === session.sessionId) setActiveSessionId(null)
  }

  const handleReconnect = async (session: P2pSessionInfo) => {
    setActiveSessionId(session.sessionId)
    await loadHistory(session.sessionId)
    await runOpenConversation(session)
  }

  const handleRetryHandshake = async () => {
    if (!handshakeRetry) return
    const session = sessions.find((s) => s.sessionId === handshakeRetry.sessionId)
    if (!session) {
      setHandshakeRetry(null)
      return
    }
    setRetryingHandshake(true)
    try {
      const ok = await runOpenConversation(session)
      if (ok) setHandshakeRetry(null)
    } finally {
      setRetryingHandshake(false)
    }
  }

  const handleSelectPeer = async (peer: P2pPeerInfo) => {
    const existing = sessions.find((s) => s.peer.deviceId === peer.deviceId)
    if (existing) {
      await handleOpenConversation(existing)
      return
    }
    setConnecting(true)
    const result = await getElectronAPI().p2p.connect(peer.ip, peer.port)
    setConnecting(false)
    if (!result.ok || !result.sessionId) {
      toast.error(result.error ?? t('toast.p2pConnectFailed'))
      return
    }
    const session = (await getElectronAPI().p2p.getSessions()).find(
      (s) => s.sessionId === result.sessionId,
    )
    if (session) upsertSession(session)
    setActiveSessionId(result.sessionId)
    await loadHistory(result.sessionId)
  }

  const handleConnectManual = async () => {
    const targetPort = normalizeP2pPort(Number(connectPort))
    setConnecting(true)
    const result = await getElectronAPI().p2p.connect(host.trim(), targetPort, message.trim() || undefined)
    setConnecting(false)
    if (!result.ok || !result.sessionId) {
      toast.error(result.error ?? t('toast.p2pConnectFailed'))
      return
    }
    setNewOpen(false)
    setHost('')
    setMessage('')
    const session = (await getElectronAPI().p2p.getSessions()).find(
      (s) => s.sessionId === result.sessionId,
    )
    if (session) upsertSession(session)
    setActiveSessionId(result.sessionId)
    await loadHistory(result.sessionId)
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      const found = await getElectronAPI().p2p.scan()
      mergePeers(found)
    } catch {
      toast.error(t('toast.p2pScanFailed'))
    } finally {
      setScanning(false)
    }
  }

  const listItems = [
    ...sessions.map((session) => ({ kind: 'session' as const, session })),
    ...peers
      .filter((peer) => !sessions.some((s) => s.peer.deviceId === peer.deviceId))
      .map((peer) => ({ kind: 'peer' as const, peer })),
  ]

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border select-none">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <Button type="button" variant="outline" size="sm" disabled={scanning} onClick={() => void handleScan()}>
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          {scanning ? t('chat.scanning') : t('chat.scanLan')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          {t('chat.newChat')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{t('chat.sessions')}</p>
        {listItems.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">{t('chat.noSessions')}</p>
        ) : (
          listItems.map((item) => {
            if (item.kind === 'session') {
              const { session } = item
              return (
                <SessionListItem
                  key={`session-${session.sessionId}`}
                  session={session}
                  active={activeSessionId === session.sessionId}
                  opening={openingSessionId === session.sessionId}
                  onOpen={() => void handleOpenConversation(session)}
                  onOpenPanel={() => void handleOpenPanel(session)}
                  onClosePanel={() => handleClosePanel(session)}
                  onRemoveFromList={() => void handleRemoveFromList(session)}
                  onReconnect={() => void handleReconnect(session)}
                />
              )
            }
            const { peer } = item
            return (
              <button
                key={`peer-${peer.deviceId}`}
                type="button"
                disabled={connecting}
                className="mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => void handleSelectPeer(peer)}
              >
                <span className="truncate font-medium">
                  {peer.displayName || peer.hostname || peer.ip}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {peer.ip}:{peer.port}
                </span>
              </button>
            )
          })
        )}
      </div>

      <AlertDialog
        open={handshakeRetry !== null}
        onOpenChange={(open) => {
          if (!open) setHandshakeRetry(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.handshakeFailedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {handshakeRetry?.error
                ? t('chat.handshakeFailedDescWithError', { error: handshakeRetry.error })
                : t('chat.handshakeFailedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={retryingHandshake}
              onClick={() => void handleRetryHandshake()}
            >
              {t('chat.handshakeRetry')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.newChatTitle')}</DialogTitle>
            <DialogDescription>{t('chat.newChatDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t('chat.host')}
            />
            <Input
              type="number"
              value={connectPort}
              onChange={(e) => setConnectPort(e.target.value)}
              placeholder={t('chat.port')}
            />
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('chat.messageOptional')}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!host.trim() || connecting}
              onClick={() => void handleConnectManual()}
            >
              {t('chat.connect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
