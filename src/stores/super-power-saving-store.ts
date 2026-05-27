import { create } from 'zustand'

interface SuperPowerSavingState {
  /** Tab 的 PTY 已挂起（进程已结束，待切回时重建） */
  suspendedTabIds: Record<string, true>
  /** 正在重建 PTY 的 Tab */
  resumingTabIds: Record<string, true>
  markTabSuspended: (tabId: string) => void
  clearTabSuspended: (tabId: string) => void
  setTabResuming: (tabId: string, resuming: boolean) => void
  clearAll: () => void
}

export const useSuperPowerSavingStore = create<SuperPowerSavingState>((set) => ({
  suspendedTabIds: {},
  resumingTabIds: {},
  markTabSuspended: (tabId) =>
    set((s) => ({
      suspendedTabIds: { ...s.suspendedTabIds, [tabId]: true },
    })),
  clearTabSuspended: (tabId) =>
    set((s) => {
      if (!s.suspendedTabIds[tabId]) return s
      const suspendedTabIds = { ...s.suspendedTabIds }
      delete suspendedTabIds[tabId]
      return { suspendedTabIds }
    }),
  setTabResuming: (tabId, resuming) =>
    set((s) => {
      const resumingTabIds = { ...s.resumingTabIds }
      if (resuming) {
        resumingTabIds[tabId] = true
      } else {
        delete resumingTabIds[tabId]
      }
      return { resumingTabIds }
    }),
  clearAll: () => set({ suspendedTabIds: {}, resumingTabIds: {} }),
}))

export function isTabPtySuspended(tabId: string): boolean {
  return !!useSuperPowerSavingStore.getState().suspendedTabIds[tabId]
}

export function isTabPtyResuming(tabId: string): boolean {
  return !!useSuperPowerSavingStore.getState().resumingTabIds[tabId]
}
