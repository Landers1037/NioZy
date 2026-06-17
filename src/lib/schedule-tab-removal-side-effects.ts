import { recordTerminalTabClosed } from '@/lib/usage-statistics'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useTabGroupStore } from '@/stores/tab-group-store'
import type { AppSettings } from '../../electron/shared/api-types'

/** Tab 列表已从 UI 移除后，在空闲时批量清理分组/活动记录等次要状态。 */
export function scheduleTabRemovalSideEffects(
  removedTabIds: string[],
  removedTerminalCount: number,
  settings: AppSettings | null | undefined,
): void {
  if (removedTabIds.length === 0 && removedTerminalCount === 0) return

  const run = () => {
    if (removedTabIds.length > 0) {
      useInactiveTabActivityStore.getState().clearTabsActivity(removedTabIds)
      useTabGroupStore.getState().removeTabsFromAllGroups(removedTabIds)

      const attachStore = useAttachPtySessionStore.getState()
      attachStore.clearSnapshots(removedTabIds)
      const removedSet = new Set(removedTabIds)
      if (attachStore.committed && removedSet.has(attachStore.committed.tabId)) {
        attachStore.setCommitted(null)
        attachStore.setPendingTabId(null)
      }
    }
    if (removedTerminalCount > 0) {
      for (let i = 0; i < removedTerminalCount; i++) {
        recordTerminalTabClosed(settings)
      }
    }
  }

  requestAnimationFrame(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 50 })
    } else {
      setTimeout(run, 0)
    }
  })
}
