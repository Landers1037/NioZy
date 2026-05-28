import { create } from 'zustand'

interface AiSidebarState {
  isOpen: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  setModalOpen: ((open: boolean) => void) | null
  registerSetModalOpen: (fn: (open: boolean) => void) => void
  unregisterSetModalOpen: () => void
}

export const useAiSidebarStore = create<AiSidebarState>((set, get) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => {
    const next = !get().isOpen
    set({ isOpen: next })
    get().setModalOpen?.(next)
  },
  setModalOpen: null,
  registerSetModalOpen: (fn) => set({ setModalOpen: fn }),
  unregisterSetModalOpen: () => set({ setModalOpen: null }),
}))
