import { useAppStore } from '@/stores/app-store'
import type { AppTab } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { toastTerminalError, applySshDynamicPasswordToCreateOptions } from '@/lib/terminal-actions'
import {
  getAllTerminalIds,
  getSplitPanes,
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { useSuperPowerSavingStore } from '@/stores/super-power-saving-store'

const suspendingTabIds = new Set<string>()
const resumingTabIds = new Set<string>()

function updateTab(tabId: string, updater: (tab: AppTab) => AppTab): void {
  useAppStore.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
  }))
}

/** 挂起 Tab：结束 PTY 进程，释放主进程与系统资源 */
export async function suspendTabPty(tab: AppTab): Promise<void> {
  if (tab.type !== 'terminal' || suspendingTabIds.has(tab.id)) return
  const ids = getAllTerminalIds(tab)
  if (ids.length === 0) return

  suspendingTabIds.add(tab.id)
  const api = getElectronAPI()
  const { clearTerminalCwd } = useAppStore.getState()

  try {
    for (const id of ids) {
      try {
        api.terminal.kill(id)
      } catch {
        /* 进程可能已退出 */
      }
      clearTerminalCwd(id)
    }
    useSuperPowerSavingStore.getState().markTabSuspended(tab.id)
  } finally {
    suspendingTabIds.delete(tab.id)
  }
}

/** 恢复 Tab：按原 spawn 配置重建全部 pane 的 PTY */
export async function resumeTabPty(tab: AppTab): Promise<boolean> {
  if (tab.type !== 'terminal' || resumingTabIds.has(tab.id)) return false

  const { settings, setTerminalCwd } = useAppStore.getState()
  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn) return false

  const panes = getSplitPanes(tab)
  if (panes.length === 0) return false

  resumingTabIds.add(tab.id)
  useSuperPowerSavingStore.getState().setTabResuming(tab.id, true)

  try {
    const api = getElectronAPI()
    const newPanes: { terminalId: string }[] = []
    let lastShell = tab.shell
    const createWithDynamic = await applySshDynamicPasswordToCreateOptions(
      spawn.create,
      spawn.sshConnectionId ?? tab.sshConnectionId,
    )
    if (!createWithDynamic) return false

    for (let i = 0; i < panes.length; i++) {
      const result = await api.terminal.create(createWithDynamic)
      lastShell = result.shell
      setTerminalCwd(result.id, result.cwd)
      newPanes.push({ terminalId: result.id })
    }

    const activeIdx = tab.activeSplitIndex ?? 0
    updateTab(tab.id, (t) =>
      normalizeTabAfterSplitChange(
        {
          ...t,
          terminalId: newPanes[0]?.terminalId,
          shell: lastShell,
          sshConnectionId: t.sshConnectionId ?? spawn.sshConnectionId,
          terminalSpawn: t.terminalSpawn ?? spawn,
        },
        newPanes,
        activeIdx,
      ),
    )

    useSuperPowerSavingStore.getState().clearTabSuspended(tab.id)
    return true
  } catch (error) {
    toastTerminalError(error)
    return false
  } finally {
    resumingTabIds.delete(tab.id)
    useSuperPowerSavingStore.getState().setTabResuming(tab.id, false)
  }
}
