import { create } from 'zustand'
import type { MarkdownThemeConfig } from '@/components/markdown-editor/theme/markdown-theme'
import { getDefaultMarkdownThemeId } from '@/components/markdown-editor/theme/markdown-theme'

export type MarkdownEditorMode = 'wysiwyg' | 'source'

export interface MarkdownTabSession {
  content: string
  persistedContent: string
  dirty: boolean
  mode: MarkdownEditorMode
  themeId: string
  loading: boolean
  loadError: string | null
}

const DEFAULT_SESSION: MarkdownTabSession = {
  content: '',
  persistedContent: '',
  dirty: false,
  mode: 'wysiwyg',
  themeId: getDefaultMarkdownThemeId(),
  loading: false,
  loadError: null,
}

interface MarkdownEditorState {
  sessions: Record<string, MarkdownTabSession>
  ensureSession: (tabId: string) => void
  removeSession: (tabId: string) => void
  setContent: (
    tabId: string,
    content: string,
    options?: { dirty?: boolean; persistedContent?: string },
  ) => void
  setDirty: (tabId: string, dirty: boolean) => void
  setMode: (tabId: string, mode: MarkdownEditorMode) => void
  setThemeId: (tabId: string, themeId: string) => void
  setLoading: (tabId: string, loading: boolean) => void
  setLoadError: (tabId: string, error: string | null) => void
  getSession: (tabId: string) => MarkdownTabSession
  isDirty: (tabId: string) => boolean
}

export const useMarkdownEditorStore = create<MarkdownEditorState>((set, get) => ({
  sessions: {},
  ensureSession: (tabId) => {
    if (get().sessions[tabId]) return
    set((s) => ({
      sessions: { ...s.sessions, [tabId]: { ...DEFAULT_SESSION } },
    }))
  },
  removeSession: (tabId) =>
    set((s) => {
      if (!s.sessions[tabId]) return s
      const sessions = { ...s.sessions }
      delete sessions[tabId]
      return { sessions }
    }),
  setContent: (tabId, content, options) =>
    set((s) => {
      const prev = s.sessions[tabId] ?? DEFAULT_SESSION
      const persistedContent = options?.persistedContent ?? prev.persistedContent
      return {
        sessions: {
          ...s.sessions,
          [tabId]: {
            ...prev,
            content,
            persistedContent,
            dirty: options?.dirty ?? content !== persistedContent,
          },
        },
      }
    }),
  setDirty: (tabId, dirty) =>
    set((s) => {
      const prev = s.sessions[tabId]
      if (!prev) return s
      return {
        sessions: {
          ...s.sessions,
          [tabId]: { ...prev, dirty },
        },
      }
    }),
  setMode: (tabId, mode) =>
    set((s) => {
      const prev = s.sessions[tabId] ?? DEFAULT_SESSION
      return {
        sessions: {
          ...s.sessions,
          [tabId]: { ...prev, mode },
        },
      }
    }),
  setThemeId: (tabId, themeId) =>
    set((s) => {
      const prev = s.sessions[tabId] ?? DEFAULT_SESSION
      return {
        sessions: {
          ...s.sessions,
          [tabId]: { ...prev, themeId },
        },
      }
    }),
  setLoading: (tabId, loading) =>
    set((s) => {
      const prev = s.sessions[tabId] ?? DEFAULT_SESSION
      return {
        sessions: {
          ...s.sessions,
          [tabId]: { ...prev, loading },
        },
      }
    }),
  setLoadError: (tabId, error) =>
    set((s) => {
      const prev = s.sessions[tabId] ?? DEFAULT_SESSION
      return {
        sessions: {
          ...s.sessions,
          [tabId]: { ...prev, loadError: error },
        },
      }
    }),
  getSession: (tabId) => get().sessions[tabId] ?? DEFAULT_SESSION,
  isDirty: (tabId) => get().sessions[tabId]?.dirty ?? false,
}))

export type { MarkdownThemeConfig }
