import { useEffect } from 'react'
import { getElectronAPI } from '@/lib/electron-client'
import { useP2pChatStore } from '@/stores/p2p-chat-store'

export function useP2pIpcSync(enabled: boolean): void {
  const upsertSession = useP2pChatStore((s) => s.upsertSession)
  const removeSession = useP2pChatStore((s) => s.removeSession)
  const setPendingRequest = useP2pChatStore((s) => s.setPendingRequest)
  const appendMessage = useP2pChatStore((s) => s.appendMessage)
  const setFileProgress = useP2pChatStore((s) => s.setFileProgress)
  const setActiveSessionId = useP2pChatStore((s) => s.setActiveSessionId)
  const setSessions = useP2pChatStore((s) => s.setSessions)

  useEffect(() => {
    if (!enabled) return
    const api = getElectronAPI().p2p

    void api.getConversations().then(setSessions).catch(() => {})

    const unsubs = [
      api.onSessionRequest((request) => setPendingRequest(request)),
      api.onSessionEstablished((session) => {
        upsertSession(session)
        setActiveSessionId(session.sessionId)
      }),
      api.onSessionDisconnected((session) => upsertSession(session)),
      api.onSessionClosed(({ sessionId }) => removeSession(sessionId)),
      api.onMessage((message) => appendMessage(message)),
      api.onFileProgress((progress) => setFileProgress(progress)),
    ]

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [
    enabled,
    appendMessage,
    removeSession,
    setActiveSessionId,
    setFileProgress,
    setPendingRequest,
    setSessions,
    upsertSession,
  ])
}
