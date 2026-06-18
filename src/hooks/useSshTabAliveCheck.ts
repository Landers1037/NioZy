import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { markSshTerminalDisconnected } from '@/lib/ssh-reconnect-actions'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'

/** 切回 SSH Tab 时检查各 pane 会话是否仍存活；不存活则标记断开以展示重连 UI */
export function useSshTabAliveCheck(activeTabId: string | null): void {
  useEffect(() => {
    if (!isElectron() || !activeTabId) return

    const { tabs } = useAppStore.getState()
    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab || !isSshTerminalTab(tab)) return

    const terminalIds = getAllTerminalIds(tab)
    if (terminalIds.length === 0) return

    let cancelled = false
    const api = getElectronAPI()

    void (async () => {
      for (const terminalId of terminalIds) {
        if (cancelled) return
        const { sshDisconnectedTerminalIds } = useAppStore.getState()
        if (sshDisconnectedTerminalIds[terminalId]) continue

        let alive = true
        try {
          alive = await api.terminal.isAlive(terminalId)
        } catch {
          alive = false
        }
        if (cancelled || alive) continue

        markSshTerminalDisconnected(terminalId, tab)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeTabId])
}
