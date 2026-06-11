import type { AppTab, TabType } from '@/stores/app-store'

export interface TabGroup {
  id: string
  name: string
  tabIds: string[]
}

const SINGLETON_TAB_TYPES: TabType[] = [
  'settings',
  'filesystem',
  'chat',
  'sandbox',
  'repo',
  'excalidraw',
  'drawio',
]

export function isSingletonTabType(type: TabType): boolean {
  return SINGLETON_TAB_TYPES.includes(type)
}

export function getGroupedTabIdSet(groups: TabGroup[]): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const tabId of group.tabIds) {
      ids.add(tabId)
    }
  }
  return ids
}

export function findGroupForTab(groups: TabGroup[], tabId: string): TabGroup | undefined {
  return groups.find((g) => g.tabIds.includes(tabId))
}

export function getUngroupedTabs(tabs: AppTab[], groups: TabGroup[]): AppTab[] {
  const grouped = getGroupedTabIdSet(groups)
  return tabs.filter((t) => !grouped.has(t.id))
}

export function getTabsInGroup(tabs: AppTab[], group: TabGroup): AppTab[] {
  const byId = new Map(tabs.map((t) => [t.id, t]))
  return group.tabIds.map((id) => byId.get(id)).filter((t): t is AppTab => t != null)
}

export function createGroupId(): string {
  return `tab-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
