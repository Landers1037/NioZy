import { useEffect, useMemo } from 'react'
import type { AppTab } from '@/stores/app-store'
import { collectActiveTerminalStreamIds } from '@/lib/inactive-tab-memory'
import { useInactiveTabOptimizationTick } from '@/hooks/useInactiveTabOptimizationTick'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useAppStore } from '@/stores/app-store'
import { isAttachPtyRenderMode, resolveAttachPtyTargetTab } from '@/lib/attach-pty-render'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

/**
 * 向主进程声明需要实时 PTY 推流的终端 id。
 * 非活动 Tab 休眠 / 优化会缩小该集合以节省内存与 CPU。
 * Attach-PTY 下仅 committed 终端推流，避免后台洪水 IPC 拖垮渲染进程。
 */
export function useTerminalStreamSync(tabs: AppTab[], activeTabId: string | null): void {
  const settings = useAppStore((s) => s.settings)
  const performance = settings?.performance
  const attachPtyMode = isAttachPtyRenderMode(settings)
  const tabLastActivityAt = useInactiveTabActivityStore((s) => s.tabLastActivityAt)
  const optimizationTick = useInactiveTabOptimizationTick()

  const streamTabsKey = tabs
    .filter((t) => t.type === 'terminal' || (t.type === 'workspace' && t.terminalId))
    .map((t) => `${t.id}:${t.terminalId ?? ''}`)
    .join(',')

  const terminalTabsKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => t.id)
    .join(',')

  const attachStreamTerminalId = useMemo(() => {
    if (!attachPtyMode) return null
    const target = resolveAttachPtyTargetTab(activeTabId, tabs)
    return target ? (getActiveTerminalId(target) ?? null) : null
  }, [attachPtyMode, activeTabId, terminalTabsKey, tabs])

  useEffect(() => {
    if (!isElectron()) return
    const ids = collectActiveTerminalStreamIds(
      tabs,
      activeTabId,
      performance,
      tabLastActivityAt,
      Date.now(),
      attachPtyMode ? { attachPtyMode: true, committedTerminalId: attachStreamTerminalId } : undefined,
    )
    getElectronAPI().terminal.setActiveStreams(ids)
  }, [
    tabs,
    activeTabId,
    performance,
    tabLastActivityAt,
    terminalTabsKey,
    streamTabsKey,
    optimizationTick,
    attachPtyMode,
    attachStreamTerminalId,
  ])
}
