import { useEffect, useRef } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { isElectron } from '@/lib/electron-client'
import {
  activateDeferredSshTab,
  cancelSshDeferredConnectActivation,
  isSshDeferredConnectActivating,
} from '@/lib/ssh-deferred-connect'

/**
 * SSH 动态密码 Tab：切换到此 Tab 时再弹框连接；切走则取消进行中的密码输入。
 */
export function useSshDeferredConnectSync(tabs: AppTab[], activeTabId: string | null): void {
  const prevActiveRef = useRef<string | null>(null)

  const deferredKey = tabs
    .filter((t) => t.sshDeferredConnect)
    .map((t) => `${t.id}:${t.deferredSplitPaneCount ?? 1}`)
    .join('|')

  useEffect(() => {
    if (!isElectron()) return

    const prevActive = prevActiveRef.current
    prevActiveRef.current = activeTabId

    if (prevActive && prevActive !== activeTabId) {
      const prevTab = tabs.find((t) => t.id === prevActive)
      if (prevTab?.sshDeferredConnect && isSshDeferredConnectActivating(prevActive)) {
        cancelSshDeferredConnectActivation()
      }
    }
  }, [activeTabId, tabs])

  useEffect(() => {
    if (!isElectron() || !activeTabId) return

    const tab = useAppStore.getState().tabs.find((t) => t.id === activeTabId)
    if (!tab?.sshDeferredConnect) return

    void activateDeferredSshTab(tab)
  }, [activeTabId, deferredKey])
}
