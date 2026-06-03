import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Plus, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import type { P2pPeerInfo, P2pSessionInfo } from '../../../electron/shared/p2p-types'

interface ChatSessionListProps {
  port: number
}

function sessionLabel(session: P2pSessionInfo): string {
  return session.peer.displayName || session.peer.hostname || session.peer.ip
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
  const setMessages = useP2pChatStore((s) => s.setMessages)

  const [newOpen, setNewOpen] = useState(false)
  const [host, setHost] = useState('')
  const [connectPort, setConnectPort] = useState(String(port || DEFAULT_P2P_PORT))
  const [message, setMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null)

  useEffect(() => {
    setConnectPort(String(port || DEFAULT_P2P_PORT))
  }, [port])

  const loadHistory = async (sessionId: string) => {
    const result = await getElectronAPI().p2p.getHistory(sessionId)
    if (result.ok) setMessages(sessionId, result.messages)
  }

  const handleOpenConversation = async (session: P2pSessionInfo) => {
    setActiveSessionId(session.sessionId)
    await loadHistory(session.sessionId)

    if (session.status === 'connected') {
      upsertSession(session)
      return
    }

    setOpeningSessionId(session.sessionId)
    try {
      const result = await getElectronAPI().p2p.openConversation(session.sessionId)
      if (result.ok && result.session) {
        upsertSession(result.session)
      } else if (!result.ok) {
        upsertSession({ ...session, status: 'disconnected' })
        toast.error(result.error ?? t('toast.p2pConnectFailed'))
      }
    } catch {
      upsertSession({ ...session, status: 'disconnected' })
      toast.error(t('toast.p2pConnectFailed'))
    } finally {
      setOpeningSessionId(null)
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
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border">
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
              const active = activeSessionId === session.sessionId
              const opening = openingSessionId === session.sessionId
              const isOnline = session.status === 'connected'
              return (
                <button
                  key={`session-${session.sessionId}`}
                  type="button"
                  disabled={opening}
                  className={cn(
                    'mb-1 flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
                    active && 'bg-muted',
                  )}
                  onClick={() => void handleOpenConversation(session)}
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
