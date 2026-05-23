import { useEffect } from 'react'
import type { AppTab } from '@/stores/app-store'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

/** 所有已打开终端 Tab 持续推流，避免切换 Tab 时缓冲回放破坏交互式 CLI 状态。 */
export function useTerminalStreamSync(tabs: AppTab[]): void {
  const terminalIdsKey = tabs
    .flatMap((tab) => (tab.type === 'terminal' ? getAllTerminalIds(tab) : []))
    .join(',')

  useEffect(() => {
    if (!isElectron()) return
    const ids = terminalIdsKey ? terminalIdsKey.split(',') : []
    void getElectronAPI().terminal.setActiveStreams(ids)
  }, [terminalIdsKey])
}
