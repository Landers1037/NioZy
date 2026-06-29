import { create } from 'zustand'
import type { AttachPtySnapshotFormat } from '@/lib/terminal-buffer-serialize'

export interface TerminalViewSnapshot {
  bufferText: string
  format: AttachPtySnapshotFormat
}

interface TerminalViewSnapshotState {
  snapshots: Record<string, TerminalViewSnapshot>
  saveSnapshot: (
    terminalId: string,
    bufferText: string,
    format: AttachPtySnapshotFormat,
  ) => void
  takeSnapshot: (terminalId: string) => TerminalViewSnapshot | undefined
  clearSnapshot: (terminalId: string) => void
  clearSnapshots: (terminalIds: string[]) => void
  reset: () => void
}

export const useTerminalViewSnapshotStore = create<TerminalViewSnapshotState>((set, get) => ({
  snapshots: {},
  saveSnapshot: (terminalId, bufferText, format) =>
    set((s) => ({
      snapshots: { ...s.snapshots, [terminalId]: { bufferText, format } },
    })),
  takeSnapshot: (terminalId) => {
    const snap = get().snapshots[terminalId]
    if (!snap) return undefined
    set((s) => {
      const next = { ...s.snapshots }
      delete next[terminalId]
      return { snapshots: next }
    })
    return snap
  },
  clearSnapshot: (terminalId) =>
    set((s) => {
      if (!s.snapshots[terminalId]) return s
      const next = { ...s.snapshots }
      delete next[terminalId]
      return { snapshots: next }
    }),
  clearSnapshots: (terminalIds) =>
    set((s) => {
      const next = { ...s.snapshots }
      let changed = false
      for (const id of terminalIds) {
        if (next[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? { snapshots: next } : s
    }),
  reset: () => set({ snapshots: {} }),
}))
