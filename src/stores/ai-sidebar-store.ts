import { create } from 'zustand'

interface AiSidebarState {
  isOpen: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  setModalOpen: ((open: boolean) => void) | null
  registerSetModalOpen: (fn: (open: boolean) => void) => void
  unregisterSetModalOpen: () => void
  /** 关闭实验性 AI 时重置 UI 状态，便于释放 Copilot 相关内存 */
  reset: () => void
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
  reset: () => set({ isOpen: false, setModalOpen: null }),
}))
