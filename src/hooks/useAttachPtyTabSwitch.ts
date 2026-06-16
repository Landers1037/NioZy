import { useEffect } from 'react'
import type { AppTab } from '@/stores/app-store'
import {
  isAttachPtyRenderMode,
  resolveAttachPtyTargetTab,
} from '@/lib/attach-pty-render'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { useAppStore } from '@/stores/app-store'

/**
 * Attach-PTY：切换 Tab 时立即 commit（方案 A）；dwell 仅用于 detach 时是否跳过快照。
 */
export function useAttachPtyTabSwitch(tabs: AppTab[], activeTabId: string | null): void {
  const settings = useAppStore((s) => s.settings)
  const enabled = isAttachPtyRenderMode(settings)

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
      store.setCommitted(null)
      return
    }

    const terminalId = getActiveTerminalId(target)
    if (!terminalId) return

    const { committed } = store
    if (committed?.tabId === target.id && committed.terminalId === terminalId) {
      return
    }

    store.setCommitted({
      tabId: target.id,
      terminalId,
      committedAt: Date.now(),
    })
  }, [enabled, activeTabId, terminalTabsKey, tabs])
}
