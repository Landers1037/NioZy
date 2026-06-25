import { useEffect, useRef } from 'react'
import type { AppTab } from '@/stores/app-store'
import { collectActiveTerminalStreamIds } from '@/lib/inactive-tab-memory'
import { useInactiveTabOptimizationTick } from '@/hooks/useInactiveTabOptimizationTick'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

function collectActiveMuxStreamIds(
  tabs: AppTab[],
  activeTabId: string | null,
  performance: ReturnType<typeof useAppStore.getState>['settings'] extends infer S
    ? S extends { performance: infer P }
      ? P
      : undefined
    : undefined,
  tabLastActivityAt: Record<string, number>,
  now: number,
): string[] {
  const ids: string[] = []
  for (const tab of tabs) {
    if (tab.type !== 'terminal' || !tab.muxMode || !tab.terminalId) continue
    const isActive = tab.id === activeTabId
    const policy = collectActiveTerminalStreamIds(
      [tab],
      isActive ? tab.id : null,
      performance,
      tabLastActivityAt,
      now,
    )
    if (policy.includes(tab.terminalId)) {
      ids.push(tab.terminalId)
    }
  }
  return ids
}

/** 向主进程声明需要实时 Mux 推流的 session id。 */
export function useMuxTerminalStreamSync(tabs: AppTab[], activeTabId: string | null): void {
  const settings = useAppStore((s) => s.settings)
  const performance = settings?.performance
  const optimizationTick = useInactiveTabOptimizationTick()

  const muxTabsKey = tabs
    .filter((t) => t.type === 'terminal' && t.muxMode)
    .map((t) => `${t.id}:${t.terminalId ?? ''}`)
    .join(',')
  const prevStreamIdsRef = useRef('')

  useEffect(() => {
    if (!isElectron()) return
    const tabLastActivityAt = useInactiveTabActivityStore.getState().tabLastActivityAt
    const ids = collectActiveMuxStreamIds(
      tabs,
      activeTabId,
      performance,
      tabLastActivityAt,
      Date.now(),
    )
    const key = ids.join(',')
    if (key === prevStreamIdsRef.current) return
    prevStreamIdsRef.current = key
    getElectronAPI().muxTerminal.setActiveStreams(ids)
  }, [tabs, activeTabId, performance, muxTabsKey, optimizationTick])
}
