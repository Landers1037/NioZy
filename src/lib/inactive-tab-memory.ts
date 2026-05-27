import type { AppTab } from '@/stores/app-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
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

export function collectActiveTerminalStreamIds(
  tabs: AppTab[],
  activeTabId: string | null,
  performance: PerformanceSettings | undefined,
  tabLastActivityAt: Record<string, number>,
  now = Date.now(),
): string[] {
  const ids: string[] = []
  for (const tab of tabs) {
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
