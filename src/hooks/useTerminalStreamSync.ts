import { useEffect } from 'react'
import type { AppTab } from '@/stores/app-store'
import { collectActiveTerminalStreamIds } from '@/lib/inactive-tab-memory'
import { useInactiveTabOptimizationTick } from '@/hooks/useInactiveTabOptimizationTick'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

/**
 * 向主进程声明需要实时 PTY 推流的终端 id。
 * 非活动 Tab 休眠 / 优化会缩小该集合以节省内存与 CPU。
 */
export function useTerminalStreamSync(tabs: AppTab[], activeTabId: string | null): void {
  const performance = useAppStore((s) => s.settings?.performance)
  const tabLastActivityAt = useInactiveTabActivityStore((s) => s.tabLastActivityAt)
  const optimizationTick = useInactiveTabOptimizationTick()

  const terminalTabsKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => t.id)
    .join(',')

  useEffect(() => {
    if (!isElectron()) return
    const ids = collectActiveTerminalStreamIds(
      tabs,
      activeTabId,
      performance,
      tabLastActivityAt,
      Date.now(),
    )
    getElectronAPI().terminal.setActiveStreams(ids)
  }, [
    tabs,
    activeTabId,
    performance,
    tabLastActivityAt,
    terminalTabsKey,
    optimizationTick,
  ])
}
