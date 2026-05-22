import type { TerminalCreateOptions } from '../../electron/shared/api-types'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { AppTab } from '@/stores/app-store'
import { getBuiltinTerminalOptions } from '@/lib/builtin-connection-options'
import { getSshConnection } from '@/lib/ssh-connection'
import type { BuiltinShellType } from '../../electron/shared/builtin-shells'

export const MAX_TERMINAL_SPLITS = 3

export interface TerminalSplitPane {
  terminalId: string
}

export interface TabTerminalSpawn {
  create: TerminalCreateOptions
  sshConnectionId?: string
}

export function getSplitPanes(tab: AppTab): TerminalSplitPane[] {
  if (tab.splitPanes?.length) return tab.splitPanes
  if (tab.terminalId) return [{ terminalId: tab.terminalId }]
  return []
}

export function getActiveSplitIndex(tab: AppTab): number {
  const panes = getSplitPanes(tab)
  if (panes.length === 0) return 0
  const idx = tab.activeSplitIndex ?? 0
  return Math.min(Math.max(0, idx), panes.length - 1)
}

export function getActiveTerminalId(tab: AppTab): string | undefined {
  const panes = getSplitPanes(tab)
  const idx = getActiveSplitIndex(tab)
  return panes[idx]?.terminalId ?? tab.terminalId
}

export function getAllTerminalIds(tab: AppTab): string[] {
  return getSplitPanes(tab).map((p) => p.terminalId)
}

export function tabHasTerminalId(tab: AppTab, terminalId: string): boolean {
  return getAllTerminalIds(tab).includes(terminalId)
}

export function connectionToTerminalSpawn(custom: CustomConnection): TabTerminalSpawn {
  const args =
    custom.type === 'ssh'
      ? [
          ...(custom.sshPort && custom.sshPort !== 22 ? ['-p', String(custom.sshPort)] : []),
          ...(custom.sshAuth === 'publickey' && custom.sshKeyPath ? ['-i', custom.sshKeyPath] : []),
          `${custom.sshUser ?? 'user'}@${custom.sshHost ?? custom.command}`,
        ]
      : custom.args

  return {
    create: {
      shell: custom.type === 'ssh' ? 'ssh' : 'custom',
      name: custom.name,
      command: custom.type === 'ssh' ? 'ssh' : custom.command,
      args,
      env: custom.env,
    },
    sshConnectionId: custom.type === 'ssh' ? custom.id : undefined,
  }
}

export function resolveTabTerminalSpawn(
  tab: AppTab,
  settings: AppSettings | null,
): TabTerminalSpawn | null {
  if (tab.terminalSpawn) return tab.terminalSpawn

  const sshConn = getSshConnection(settings, tab.sshConnectionId)
  if (sshConn) return connectionToTerminalSpawn(sshConn)

  const shell = tab.shell as BuiltinShellType | 'custom' | 'ssh' | undefined
  if (shell && shell !== 'custom' && shell !== 'ssh') {
    return { create: getBuiltinTerminalOptions(shell, settings) }
  }

  if (shell === 'ssh') {
    return { create: { shell: 'ssh' } }
  }

  if (shell === 'custom') {
    return { create: { shell: 'custom' } }
  }

  return null
}

export function normalizeTabAfterSplitChange(
  tab: AppTab,
  panes: TerminalSplitPane[],
  activeSplitIndex: number,
): AppTab {
  const idx = Math.min(Math.max(0, activeSplitIndex), Math.max(0, panes.length - 1))
  const next: AppTab = {
    ...tab,
    terminalId: panes[0]?.terminalId,
    activeSplitIndex: panes.length > 1 ? idx : undefined,
    splitPanes: panes.length > 1 ? panes : undefined,
  }
  return next
}
