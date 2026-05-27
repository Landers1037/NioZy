import { create } from 'zustand'

interface InactiveTabActivityState {
  tabLastActivityAt: Record<string, number>
  touchTabActivity: (tabId: string, at?: number) => void
  clearTabActivity: (tabId: string) => void
}

export const useInactiveTabActivityStore = create<InactiveTabActivityState>((set) => ({
  tabLastActivityAt: {},
  touchTabActivity: (tabId, at = Date.now()) =>
    set((s) => ({
      tabLastActivityAt: { ...s.tabLastActivityAt, [tabId]: at },
    })),
  clearTabActivity: (tabId) =>
    set((s) => {
      if (!s.tabLastActivityAt[tabId]) return s
      const tabLastActivityAt = { ...s.tabLastActivityAt }
      delete tabLastActivityAt[tabId]
      return { tabLastActivityAt }
    }),
}))

export function touchTabActivity(tabId: string): void {
  useInactiveTabActivityStore.getState().touchTabActivity(tabId)
}
