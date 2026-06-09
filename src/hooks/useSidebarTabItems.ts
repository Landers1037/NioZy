import { useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useTabGroupStore } from '@/stores/tab-group-store'
import {
  getTabsInGroup,
  getUngroupedTabs,
  isSingletonTabType,
  type TabGroup,
} from '@/lib/tab-groups'
import type { AppTab } from '@/stores/app-store'

export type SidebarItem =
  | { kind: 'tab'; tab: AppTab }
  | { kind: 'group'; group: TabGroup }

export function useSidebarTabItems(): {
  sidebarItems: SidebarItem[]
  activeGroup: TabGroup | undefined
  inGroupView: boolean
} {
  const tabs = useAppStore((s) => s.tabs)
  const groups = useTabGroupStore((s) => s.groups)
  const activeGroupId = useTabGroupStore((s) => s.activeGroupId)
  const tabsSnapshotAtGroupEntry = useTabGroupStore((s) => s.tabsSnapshotAtGroupEntry)

  const activeGroup = activeGroupId
    ? groups.find((g) => g.id === activeGroupId)
    : undefined

  const sidebarItems = useMemo((): SidebarItem[] => {
    if (activeGroup) {
      const groupTabs = getTabsInGroup(tabs, activeGroup)
      const ephemeralSingletons = tabs.filter(
        (tab) =>
          isSingletonTabType(tab.type) &&
          tabsSnapshotAtGroupEntry != null &&
          !tabsSnapshotAtGroupEntry.has(tab.id),
      )
      return [...groupTabs, ...ephemeralSingletons].map((tab) => ({ kind: 'tab', tab }))
    }
    const items: SidebarItem[] = getUngroupedTabs(tabs, groups).map((tab) => ({
      kind: 'tab',
      tab,
    }))
    for (const group of groups) {
      items.push({ kind: 'group', group })
    }
    return items
  }, [activeGroup, groups, tabs, tabsSnapshotAtGroupEntry])

  return {
    sidebarItems,
    activeGroup,
    inGroupView: activeGroup != null,
  }
}
