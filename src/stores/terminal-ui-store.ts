import { create } from 'zustand'

export interface TerminalContextMenuState {
  x: number
  y: number
  terminalId: string
  tabId: string
  hasSelection: boolean
}

interface TerminalUiStore {
  contextMenu: TerminalContextMenuState | null
  searchOpenNonce: number
  openContextMenu: (state: TerminalContextMenuState) => void
  closeContextMenu: () => void
  requestTerminalSearch: () => void
}

export const useTerminalUiStore = create<TerminalUiStore>((set) => ({
  contextMenu: null,
  searchOpenNonce: 0,
  openContextMenu: (contextMenu) => set({ contextMenu }),
  closeContextMenu: () => set({ contextMenu: null }),
  requestTerminalSearch: () =>
    set((state) => ({ searchOpenNonce: state.searchOpenNonce + 1 })),
}))
