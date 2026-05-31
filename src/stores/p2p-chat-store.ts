import { create } from 'zustand'
import type {
  P2pChatMessage,
  P2pFileProgress,
  P2pIncomingRequest,
  P2pPeerInfo,
  P2pSessionInfo,
} from '../../electron/shared/p2p-types'

interface P2pChatState {
  peers: P2pPeerInfo[]
  sessions: P2pSessionInfo[]
  messagesBySession: Record<string, P2pChatMessage[]>
  fileProgress: Record<string, P2pFileProgress>
  pendingRequest: P2pIncomingRequest | null
  activeSessionId: string | null
  scanning: boolean
  setScanning: (v: boolean) => void
  setPeers: (peers: P2pPeerInfo[]) => void
  mergePeers: (peers: P2pPeerInfo[]) => void
  setSessions: (sessions: P2pSessionInfo[]) => void
  upsertSession: (session: P2pSessionInfo) => void
  removeSession: (sessionId: string) => void
  setActiveSessionId: (sessionId: string | null) => void
  setPendingRequest: (request: P2pIncomingRequest | null) => void
  setMessages: (sessionId: string, messages: P2pChatMessage[]) => void
  appendMessage: (message: P2pChatMessage) => void
  updateMessage: (sessionId: string, messageId: string, patch: Partial<P2pChatMessage>) => void
  clearMessages: (sessionId: string) => void
  setFileProgress: (progress: P2pFileProgress) => void
}

export const useP2pChatStore = create<P2pChatState>((set, get) => ({
  peers: [],
  sessions: [],
  messagesBySession: {},
  fileProgress: {},
  pendingRequest: null,
  activeSessionId: null,
  scanning: false,
  setScanning: (scanning) => set({ scanning }),
  setPeers: (peers) => set({ peers }),
  mergePeers: (peers) => {
    const merged = new Map(get().peers.map((p) => [p.deviceId, p]))
    for (const peer of peers) merged.set(peer.deviceId, peer)
    set({ peers: [...merged.values()] })
  },
  setSessions: (sessions) => set({ sessions }),
  upsertSession: (session) =>
    set((s) => {
      const others = s.sessions.filter((item) => item.sessionId !== session.sessionId)
      return { sessions: [...others, session] }
    }),
  removeSession: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.filter((item) => item.sessionId !== sessionId),
      activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
    })),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setPendingRequest: (pendingRequest) => set({ pendingRequest }),
  setMessages: (sessionId, messages) =>
    set((s) => ({
      messagesBySession: { ...s.messagesBySession, [sessionId]: messages },
    })),
  appendMessage: (message) =>
    set((s) => {
      const list = s.messagesBySession[message.sessionId] ?? []
      if (list.some((m) => m.id === message.id)) {
        return {
          messagesBySession: {
            ...s.messagesBySession,
            [message.sessionId]: list.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
          },
        }
      }
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [message.sessionId]: [...list, message],
        },
      }
    }),
  updateMessage: (sessionId, messageId, patch) =>
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...patch } : m,
        ),
      },
    })),
  clearMessages: (sessionId: string) =>
    set((s) => {
      const messagesBySession = { ...s.messagesBySession, [sessionId]: [] }
      const fileProgress = { ...s.fileProgress }
      for (const [fileId, progress] of Object.entries(fileProgress)) {
        if (progress.sessionId === sessionId) delete fileProgress[fileId]
      }
      return { messagesBySession, fileProgress }
    }),
  setFileProgress: (progress) =>
    set((s) => ({
      fileProgress: { ...s.fileProgress, [progress.fileId]: progress },
    })),
}))
