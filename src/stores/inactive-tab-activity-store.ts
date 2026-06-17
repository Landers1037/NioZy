import { create } from 'zustand'

interface InactiveTabActivityState {
  tabLastActivityAt: Record<string, number>
  touchTabActivity: (tabId: string, at?: number) => void
  clearTabActivity: (tabId: string) => void
  clearTabsActivity: (tabIds: string[]) => void
}

export const useInactiveTabActivityStore = create<InactiveTabActivityState>((set, get) => ({
  tabLastActivityAt: {},
  touchTabActivity: (tabId, at = Date.now()) =>
    set((s) => ({
      tabLastActivityAt: { ...s.tabLastActivityAt, [tabId]: at },
    })),
  clearTabActivity: (tabId) => {
    get().clearTabsActivity([tabId])
  },
  clearTabsActivity: (tabIds) =>
    set((s) => {
      if (tabIds.length === 0) return s
      let changed = false
      const tabLastActivityAt = { ...s.tabLastActivityAt }
      for (const id of tabIds) {
        if (id in tabLastActivityAt) {
          delete tabLastActivityAt[id]
          changed = true
        }
      }
      return changed ? { tabLastActivityAt } : s
    }),
}))

export function touchTabActivity(tabId: string): void {
  useInactiveTabActivityStore.getState().touchTabActivity(tabId)
}
