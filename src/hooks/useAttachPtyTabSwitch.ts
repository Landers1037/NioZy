import { useEffect } from 'react'
import type { AppTab } from '@/stores/app-store'
import {
  getAttachPtyTabSwitchDwellMs,
  isAttachPtyRenderMode,
  resolveAttachPtyTargetTab,
} from '@/lib/attach-pty-render'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { useAppStore } from '@/stores/app-store'

/**
 * Attach-PTY：Tab 停留超过配置的 dwell 时间后才提交 attach 目标；快速切换不触发 detach/restore。
 */
export function useAttachPtyTabSwitch(tabs: AppTab[], activeTabId: string | null): void {
  const settings = useAppStore((s) => s.settings)
  const enabled = isAttachPtyRenderMode(settings)
  const dwellMs = getAttachPtyTabSwitchDwellMs(settings)

  const terminalTabsKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => `${t.id}:${getActiveTerminalId(t) ?? ''}`)
    .join('|')

  useEffect(() => {
    if (!enabled) {
      useAttachPtySessionStore.getState().reset()
      return
    }

    const target = resolveAttachPtyTargetTab(activeTabId, tabs)
    const store = useAttachPtySessionStore.getState()

    if (!target) {
      store.setPendingTabId(null)
      store.setCommitted(null)
      return
    }

    const terminalId = getActiveTerminalId(target)
    if (!terminalId) return

    const { committed } = store
    if (committed?.tabId === target.id && committed.terminalId === terminalId) {
      store.setPendingTabId(null)
      return
    }

    store.setPendingTabId(target.id)

    const timer = window.setTimeout(() => {
      const latest = resolveAttachPtyTargetTab(
        useAppStore.getState().activeTabId,
        useAppStore.getState().tabs,
      )
      if (!latest || latest.id !== target.id) return
      const latestTerminalId = getActiveTerminalId(latest)
      if (!latestTerminalId || latestTerminalId !== terminalId) return

      useAttachPtySessionStore.getState().setPendingTabId(null)
      useAttachPtySessionStore.getState().setCommitted({
        tabId: target.id,
        terminalId,
      })
    }, dwellMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [enabled, dwellMs, activeTabId, terminalTabsKey, tabs])
}
