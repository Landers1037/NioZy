import { create } from 'zustand'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import i18n from '@/lib/i18n'
import { toast } from 'sonner'
import type {
  AgentConnectionState,
  AgentEvent,
  AgentFileSearchResult,
  AgentMessage,
  AgentMode,
  AgentReferencedFile,
} from '../../electron/shared/agent-types'

interface AgentStoreState {
  selectedDir: string
  gitBranch: string | null
  model: string
  mode: AgentMode
  messages: AgentMessage[]
  connectionState: AgentConnectionState
  runtimeError: string | null
  sessionId: string
  initialized: boolean
  bootstrap: () => Promise<void>
  ensureRuntime: () => Promise<void>
  pickDirectory: () => Promise<void>
  setSelectedDir: (dir: string) => Promise<void>
  setModel: (model: string) => Promise<void>
  setMode: (mode: AgentMode) => Promise<void>
  searchFiles: (query: string) => Promise<AgentFileSearchResult[]>
  sendMessage: (text: string, referencedFiles?: AgentReferencedFile[]) => Promise<void>
  stopMessage: () => Promise<void>
  resetSession: () => Promise<void>
  applyEvent: (event: AgentEvent) => void
}

let subscribedToAgentEvents = false
let lastAgentErrorToast = ''

function isValidAgentMessage(message: unknown): message is AgentMessage {
  if (!message || typeof message !== 'object') return false
  const candidate = message as Partial<AgentMessage>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'string'
  )
}

function normalizeMessages(messages: unknown): AgentMessage[] {
  if (!Array.isArray(messages)) return []
  return messages.filter(isValidAgentMessage)
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  selectedDir: '',
  gitBranch: null,
  model: '',
  mode: 'plan',
  messages: [],
  connectionState: 'idle',
  runtimeError: null,
  sessionId: 'niozy-agent',
  initialized: false,
  bootstrap: async () => {
    if (!isElectron()) return
    if (!subscribedToAgentEvents) {
      getElectronAPI().agent.onEvent((event) => {
        useAgentStore.getState().applyEvent(event)
      })
      subscribedToAgentEvents = true
    }
    const state = await getElectronAPI().agent.getState()
    set({
      selectedDir: state.session.workspaceDir,
      gitBranch: state.session.gitBranch,
      model: state.session.model,
      mode: state.session.mode,
      messages: normalizeMessages(state.session.messages),
      connectionState: state.runtime.state,
      runtimeError: state.runtime.lastError ?? null,
      sessionId: state.session.sessionId,
      initialized: true,
    })
  },
  ensureRuntime: async () => {
    const state = await getElectronAPI().agent.ensureRuntime()
    set({
      connectionState: state.runtime.state,
      runtimeError: state.runtime.lastError ?? null,
      model: state.session.model,
    })
  },
  pickDirectory: async () => {
    const dir = await getElectronAPI().agent.pickDirectory()
    if (!dir) return
    await get().setSelectedDir(dir)
  },
  setSelectedDir: async (dir) => {
    const state = await getElectronAPI().agent.setWorkspaceDir(dir)
    set({
      selectedDir: state.session.workspaceDir,
      gitBranch: state.session.gitBranch,
    })
  },
  setModel: async (model) => {
    const state = await getElectronAPI().agent.setModel(model)
    set({ model: state.session.model })
  },
  setMode: async (mode) => {
    const state = await getElectronAPI().agent.setMode(mode)
    set({ mode: state.session.mode })
  },
  searchFiles: async (query) => {
    if (!get().selectedDir.trim()) return []
    return getElectronAPI().agent.searchFiles(query)
  },
  sendMessage: async (text, referencedFiles = []) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!get().selectedDir.trim()) {
      const message = i18n.t('agent.errors.workspaceRequired')
      lastAgentErrorToast = message
      toast.error(message)
      set({
        runtimeError: message,
      })
      return
    }
    await getElectronAPI().agent.sendMessage({ text: trimmed, referencedFiles })
  },
  stopMessage: async () => {
    await getElectronAPI().agent.stopMessage()
  },
  resetSession: async () => {
    const state = await getElectronAPI().agent.resetSession()
    set({
      messages: normalizeMessages(state.session.messages),
      sessionId: state.session.sessionId,
    })
  },
  applyEvent: (event) => {
    if (event.type === 'runtime') {
      set({
        connectionState: event.runtime.state,
        runtimeError: event.runtime.lastError ?? null,
      })
      return
    }
    if (event.type === 'session') {
      set({
        selectedDir: event.session.workspaceDir,
        gitBranch: event.session.gitBranch,
        model: event.session.model,
        mode: event.session.mode,
        messages: normalizeMessages(event.session.messages),
        sessionId: event.session.sessionId,
        runtimeError: null,
      })
      return
    }
    if (event.type === 'message') {
      if (!isValidAgentMessage(event.message)) return
      set((state) => ({
        messages: state.messages.some((message) => message.id === event.message.id)
          ? state.messages
          : [...state.messages, event.message],
      }))
      return
    }
    if (event.type === 'messageDelta') {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === event.messageId
            ? { ...message, content: `${message.content}${event.delta}` }
            : message,
        ),
      }))
      return
    }
    if (event.type === 'messageDone') {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === event.messageId ? { ...message, streaming: false } : message,
        ),
      }))
      return
    }
    if (event.type === 'error') {
      if (event.error && event.error !== lastAgentErrorToast) {
        lastAgentErrorToast = event.error
        toast.error(event.error)
      }
      set({
        connectionState: event.fatal ? 'error' : get().connectionState,
        runtimeError: event.error,
      })
    }
  },
}))
