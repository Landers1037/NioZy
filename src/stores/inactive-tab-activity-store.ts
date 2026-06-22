import { create } from 'zustand'

/** 合并高频 touch，避免每次按键触发全局重渲染与 IPC */
const TOUCH_TAB_ACTIVITY_MIN_INTERVAL_MS = 1_000

interface InactiveTabActivityState {
  tabLastActivityAt: Record<string, number>
  touchTabActivity: (tabId: string, at?: number) => void
  clearTabActivity: (tabId: string) => void
  clearTabsActivity: (tabIds: string[]) => void
}

export const useInactiveTabActivityStore = create<InactiveTabActivityState>((set, get) => ({
  tabLastActivityAt: {},
  touchTabActivity: (tabId, at = Date.now()) =>
    set((s) => {
      const prev = s.tabLastActivityAt[tabId]
      if (prev !== undefined && at - prev < TOUCH_TAB_ACTIVITY_MIN_INTERVAL_MS) return s
      return {
        tabLastActivityAt: { ...s.tabLastActivityAt, [tabId]: at },
      }
    }),
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
