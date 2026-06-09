import { create } from 'zustand'
import {
  createGroupId,
  isSingletonTabType,
  type TabGroup,
} from '@/lib/tab-groups'
import { useAppStore } from '@/stores/app-store'

interface TabGroupState {
  groups: TabGroup[]
  /** 当前在侧栏中展开的分组 id；null 表示外层列表 */
  activeGroupId: string | null
  /** 进入分组视图时已有的 Tab id，用于返回外层时销毁期间新开的单例 Tab */
  tabsSnapshotAtGroupEntry: Set<string> | null
  enterGroup: (groupId: string) => void
  exitGroup: () => void
  addTabToGroup: (tabId: string, groupId: string) => void
  /** 若当前处于分组视图，将 Tab 加入该分组 */
  addTabToActiveGroupIfAny: (tabId: string) => void
  addTabToNewGroup: (tabId: string, name: string) => void
  removeTabFromAllGroups: (tabId: string) => void
  renameGroup: (groupId: string, name: string) => void
  deleteGroup: (groupId: string) => void
}

function pruneEmptyGroups(groups: TabGroup[]): TabGroup[] {
  return groups.filter((g) => g.tabIds.length > 0)
}

function removeTabFromGroups(groups: TabGroup[], tabId: string): TabGroup[] {
  return pruneEmptyGroups(
    groups.map((g) => ({
      ...g,
      tabIds: g.tabIds.filter((id) => id !== tabId),
    })),
  )
}

export const useTabGroupStore = create<TabGroupState>((set, get) => ({
  groups: [],
  activeGroupId: null,
  tabsSnapshotAtGroupEntry: null,

  enterGroup: (groupId) => {
    const tabIds = new Set(useAppStore.getState().tabs.map((t) => t.id))
    set({
      activeGroupId: groupId,
      tabsSnapshotAtGroupEntry: tabIds,
    })
  },

  exitGroup: () => {
    const snapshot = get().tabsSnapshotAtGroupEntry
    if (snapshot) {
      const { tabs, removeTab } = useAppStore.getState()
      for (const tab of tabs) {
        if (isSingletonTabType(tab.type) && !snapshot.has(tab.id)) {
          removeTab(tab.id)
        }
      }
    }
    set({ activeGroupId: null, tabsSnapshotAtGroupEntry: null })
  },

  addTabToGroup: (tabId, groupId) => {
    set((s) => {
      const withoutTab = removeTabFromGroups(s.groups, tabId)
      const groups = withoutTab.map((g) =>
        g.id === groupId ? { ...g, tabIds: [...g.tabIds, tabId] } : g,
      )
      return { groups }
    })
  },

  addTabToActiveGroupIfAny: (tabId) => {
    const { activeGroupId, groups, addTabToGroup } = get()
    if (!activeGroupId) return
    if (!groups.some((g) => g.id === activeGroupId)) return
    addTabToGroup(tabId, activeGroupId)
  },

  addTabToNewGroup: (tabId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const groupId = createGroupId()
    set((s) => {
      const withoutTab = removeTabFromGroups(s.groups, tabId)
      return {
        groups: [...withoutTab, { id: groupId, name: trimmed, tabIds: [tabId] }],
      }
    })
  },

  removeTabFromAllGroups: (tabId) => {
    set((s) => ({ groups: removeTabFromGroups(s.groups, tabId) }))
  },

  renameGroup: (groupId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
    }))
  },

  deleteGroup: (groupId) => {
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      activeGroupId: s.activeGroupId === groupId ? null : s.activeGroupId,
      tabsSnapshotAtGroupEntry:
        s.activeGroupId === groupId ? null : s.tabsSnapshotAtGroupEntry,
    }))
  },
}))
