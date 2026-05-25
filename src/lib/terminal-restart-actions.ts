import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getActiveTerminalId,
  getSplitPanes,
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { toastTerminalError } from '@/lib/terminal-actions'
import type { BuiltinShellType } from '../../electron/shared/builtin-shells'

const ELEVATABLE_SHELLS = new Set<BuiltinShellType>(['powershell', 'cmd', 'pwsh'])

function updateTab(
  tabId: string,
  updater: (tab: import('@/stores/app-store').AppTab) => import('@/stores/app-store').AppTab,
): void {
  useAppStore.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
  }))
}

export function isElevatableLocalShell(shell: string | undefined): boolean {
  return !!shell && ELEVATABLE_SHELLS.has(shell as BuiltinShellType)
}

export function canShowRestartAsAdminMenu(
  tab: import('@/stores/app-store').AppTab,
  appElevated: boolean,
): boolean {
  if (getElectronAPI().system.platform !== 'win32') return false
  if (appElevated || tab.type !== 'terminal') return false
  if (tab.terminalSpawn?.create.elevated) return false

  const spawn = resolveTabTerminalSpawn(tab, useAppStore.getState().settings)
  if (!spawn) return false
  if (spawn.sshConnectionId || spawn.create.shell === 'ssh') return false
  return isElevatableLocalShell(spawn.create.shell)
}

/** 以管理员权限重启当前终端 Tab（或拆分视图中的活动 pane） */
export async function restartTerminalTabAsAdmin(tabId: string): Promise<void> {
  const { tabs, settings, terminalCwds, setTerminalCwd, clearTerminalCwd } =
    useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId && t.type === 'terminal')
  if (!tab) return

  const oldTerminalId = getActiveTerminalId(tab)
  if (!oldTerminalId) return

  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn || !isElevatableLocalShell(spawn.create.shell)) {
    toast.error(i18n.t('toast.restartAsAdminUnsupported'))
    return
  }

  const cwd = terminalCwds[oldTerminalId] ?? spawn.create.cwd

  try {
    getElectronAPI().terminal.kill(oldTerminalId)
    clearTerminalCwd(oldTerminalId)

    const createOptions = {
      ...spawn.create,
      cwd,
      elevated: true,
    }
    const result = await getElectronAPI().terminal.create(createOptions)
    setTerminalCwd(result.id, result.cwd)

    const panes = getSplitPanes(tab)
    const activeIdx = tab.activeSplitIndex ?? 0
    const newPanes = panes.map((p, i) =>
      panes.length === 1 || i === activeIdx ? { terminalId: result.id } : p,
    )

    const nextSpawn = {
      ...spawn,
      create: { ...createOptions },
    }

    updateTab(tabId, (t) =>
      normalizeTabAfterSplitChange(
        {
          ...t,
          terminalId: result.id,
          shell: result.shell,
          title: t.customTitle ? t.title : result.name,
          terminalSpawn: nextSpawn,
        },
        newPanes,
        activeIdx,
      ),
    )
  } catch (error) {
    toastTerminalError(error, i18n.t('tab.restartAsAdmin'))
  }
}
