import { closeTerminalTabs } from '@/lib/tab-actions'
import { useTabGroupStore } from '@/stores/tab-group-store'

/** 关闭分组内全部终端 Tab 并移除分组 */
export function closeTabGroup(groupId: string): void {
  const store = useTabGroupStore.getState()
  const group = store.groups.find((g) => g.id === groupId)
  if (!group) return

  if (store.activeGroupId === groupId) {
    store.exitGroup()
  }

  const tabIds = [...group.tabIds]
  closeTerminalTabs(tabIds)
  store.deleteGroup(groupId)
}
