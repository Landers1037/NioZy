import { create } from 'zustand'

export interface AttachPtyTabSnapshot {
  bufferText: string
}

export interface AttachPtyCommittedSession {
  tabId: string
  terminalId: string
}

interface AttachPtySessionState {
  committed: AttachPtyCommittedSession | null
  pendingTabId: string | null
  snapshots: Record<string, AttachPtyTabSnapshot>
  setCommitted: (session: AttachPtyCommittedSession | null) => void
  setPendingTabId: (tabId: string | null) => void
  saveSnapshot: (tabId: string, bufferText: string) => void
  peekSnapshot: (tabId: string) => AttachPtyTabSnapshot | undefined
  takeSnapshot: (tabId: string) => AttachPtyTabSnapshot | undefined
  clearSnapshot: (tabId: string) => void
  clearSnapshots: (tabIds: string[]) => void
  reset: () => void
}

export const useAttachPtySessionStore = create<AttachPtySessionState>((set, get) => ({
  committed: null,
  pendingTabId: null,
  snapshots: {},
  setCommitted: (committed) => set({ committed }),
  setPendingTabId: (pendingTabId) => set({ pendingTabId }),
  saveSnapshot: (tabId, bufferText) =>
    set((s) => ({
      snapshots: { ...s.snapshots, [tabId]: { bufferText } },
    })),
  peekSnapshot: (tabId) => get().snapshots[tabId],
  takeSnapshot: (tabId) => {
    const snap = get().snapshots[tabId]
    if (!snap) return undefined
    set((s) => {
      const next = { ...s.snapshots }
      delete next[tabId]
      return { snapshots: next }
    })
    return snap
  },
  clearSnapshot: (tabId) =>
    set((s) => {
      if (!s.snapshots[tabId]) return s
      const next = { ...s.snapshots }
      delete next[tabId]
      return { snapshots: next }
    }),
  clearSnapshots: (tabIds) =>
    set((s) => {
      const next = { ...s.snapshots }
      let changed = false
      for (const id of tabIds) {
        if (next[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? { snapshots: next } : s
    }),
  reset: () => set({ committed: null, pendingTabId: null, snapshots: {} }),
}))
