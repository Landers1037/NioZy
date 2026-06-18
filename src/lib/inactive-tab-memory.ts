import type { AppTab } from '@/stores/app-store'
import { getAllTerminalIds, getSplitPanes } from '@/lib/terminal-tab-utils'
import type { PerformanceSettings } from '../../electron/shared/performance-settings'
import { DEFAULT_PERFORMANCE_SETTINGS } from '../../electron/shared/performance-settings'

/** 非活动 Tab 优化：无操作多久后卸载终端视图 */
export const INACTIVE_TAB_OPTIMIZATION_IDLE_MS = 5 * 60 * 1000

export interface InactiveTabPolicy {
  /** 是否挂载 TerminalView / WterminalView */
  mountTerminal: boolean
  /** 是否向渲染进程实时推送 PTY 输出 */
  streamActive: boolean
  /** 非活动 Tab 休眠样式（content-visibility 等） */
  sleepStyle: boolean
}

export function resolveInactiveTabPolicy(
  performance: PerformanceSettings | undefined,
  isTabActive: boolean,
  lastActivityAt: number | undefined,
  now = Date.now(),
): InactiveTabPolicy {
  const s = performance ?? DEFAULT_PERFORMANCE_SETTINGS

  if (s.superPowerSaving) {
    if (isTabActive) {
      return { mountTerminal: true, streamActive: true, sleepStyle: false }
    }
    return { mountTerminal: false, streamActive: false, sleepStyle: false }
  }

  if (isTabActive) {
    return { mountTerminal: true, streamActive: true, sleepStyle: false }
  }

  const lastAt = lastActivityAt ?? now
  const idleMs = now - lastAt

  if (s.inactiveTabOptimization && idleMs >= INACTIVE_TAB_OPTIMIZATION_IDLE_MS) {
    return { mountTerminal: false, streamActive: false, sleepStyle: false }
  }

  if (s.inactiveTabSleep) {
    return { mountTerminal: true, streamActive: false, sleepStyle: true }
  }

  return { mountTerminal: true, streamActive: true, sleepStyle: false }
}

export interface CollectActiveTerminalStreamOptions {
  /** Attach-PTY：仅 committed 终端实时推流，后台 yes 洪水进主进程 pausedOutput */
  attachPtyMode?: boolean
  committedTerminalId?: string | null
}

export function collectActiveTerminalStreamIds(
  tabs: AppTab[],
  activeTabId: string | null,
  performance: PerformanceSettings | undefined,
  tabLastActivityAt: Record<string, number>,
  now = Date.now(),
  options?: CollectActiveTerminalStreamOptions,
): string[] {
  if (options?.attachPtyMode) {
    const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : undefined
    if (activeTab?.type === 'workspace' && activeTab.terminalId) {
      const policy = resolveInactiveTabPolicy(
        performance,
        true,
        tabLastActivityAt[activeTab.id],
        now,
      )
      if (policy.streamActive) {
        return [activeTab.terminalId]
      }
      return []
    }
    if (
      activeTab?.type === 'terminal' &&
      getSplitPanes(activeTab).length > 1
    ) {
      const policy = resolveInactiveTabPolicy(
        performance,
        true,
        tabLastActivityAt[activeTab.id],
        now,
      )
      if (!policy.streamActive) return []
      return getAllTerminalIds(activeTab)
    }

    const committedTerminalId = options.committedTerminalId
    return committedTerminalId ? [committedTerminalId] : []
  }

  const ids: string[] = []
  for (const tab of tabs) {
    if (tab.type === 'workspace' && tab.terminalId) {
      const isActive = tab.id === activeTabId
      const policy = resolveInactiveTabPolicy(
        performance,
        isActive,
        tabLastActivityAt[tab.id],
        now,
      )
      if (policy.streamActive) {
        ids.push(tab.terminalId)
      }
      continue
    }
    if (tab.type !== 'terminal') continue
    const termIds = getAllTerminalIds(tab)
    if (termIds.length === 0) continue
    const isActive = tab.id === activeTabId
    const policy = resolveInactiveTabPolicy(
      performance,
      isActive,
      tabLastActivityAt[tab.id],
      now,
    )
    if (policy.streamActive) {
      ids.push(...termIds)
    }
  }
  return ids
}
