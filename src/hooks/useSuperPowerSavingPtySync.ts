import { useEffect, useRef } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { resumeTabPty, suspendTabPty } from '@/lib/super-power-saving-pty'
import { useSuperPowerSavingStore } from '@/stores/super-power-saving-store'
import { isElectron } from '@/lib/electron-client'

/**
 * 超级省电：非活动 Tab 挂起 PTY；活动 Tab 恢复 PTY。
 */
export function useSuperPowerSavingPtySync(tabs: AppTab[], activeTabId: string | null): void {
  const superPowerSaving = useAppStore((s) => s.settings?.performance.superPowerSaving === true)
  const prevEnabledRef = useRef(false)

  const terminalTabsKey = tabs
    .filter((t) => t.type === 'terminal')
    .map((t) => `${t.id}:${getAllTerminalIds(t).join(',')}`)
    .join('|')

  useEffect(() => {
    if (!isElectron()) return

    if (!superPowerSaving) {
      if (prevEnabledRef.current) {
        const suspended = { ...useSuperPowerSavingStore.getState().suspendedTabIds }
        useSuperPowerSavingStore.getState().clearAll()
        void (async () => {
          for (const tabId of Object.keys(suspended)) {
            const tab = useAppStore.getState().tabs.find((t) => t.id === tabId)
            if (tab?.type === 'terminal') {
              await resumeTabPty(tab)
            }
          }
        })()
      }
      prevEnabledRef.current = false
      return
    }

    prevEnabledRef.current = true

    const terminalTabs = tabs.filter(
      (t) => t.type === 'terminal' && getAllTerminalIds(t).length > 0,
    )

    void (async () => {
      for (const tab of terminalTabs) {
        if (tab.id === activeTabId) {
          if (useSuperPowerSavingStore.getState().suspendedTabIds[tab.id]) {
            await resumeTabPty(tab)
          }
        } else if (!useSuperPowerSavingStore.getState().suspendedTabIds[tab.id]) {
          await suspendTabPty(tab)
        }
      }
    })()
  }, [superPowerSaving, activeTabId, terminalTabsKey, tabs])
}
