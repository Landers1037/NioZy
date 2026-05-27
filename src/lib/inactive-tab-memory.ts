import type { AppTab } from '@/stores/app-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import type { ShellSettings } from '../../electron/shared/shell-settings'
import { DEFAULT_SHELL_SETTINGS } from '../../electron/shared/shell-settings'

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
  shell: ShellSettings | undefined,
  isTabActive: boolean,
  lastActivityAt: number | undefined,
  now = Date.now(),
): InactiveTabPolicy {
  const s = shell ?? DEFAULT_SHELL_SETTINGS

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
  shell: ShellSettings | undefined,
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
      shell,
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
