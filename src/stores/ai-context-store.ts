import { create } from 'zustand'

interface AiContextStore {
  revision: number
  bumpRevision: () => void
}

export const useAiContextStore = create<AiContextStore>((set) => ({
  revision: 0,
  bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
}))
