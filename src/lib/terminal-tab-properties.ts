import {
  BUILTIN_SHELL_EXECUTABLE,
  BUILTIN_SHELL_LABELS,
  type BuiltinShellType,
} from '../../electron/shared/builtin-shells'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { AppTab } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { getSshConnection } from '@/lib/ssh-connection'
import {
  getActiveTerminalId,
  getSplitPanes,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { TELNET_BRIDGE_SENTINEL } from '@/lib/connection-terminal-spawn'

export interface TerminalTabPropertyRow {
  labelKey: string
  value: string
  monospace?: boolean
}

function formatArgs(args: string[] | undefined): string | null {
  if (!args || args.length === 0) return null
  return args.join(' ')
}

function resolveTabConnection(
  tab: AppTab,
  settings: AppSettings | null,
): CustomConnection | null {
  const connId =
    tab.sshConnectionId ??
    tab.terminalSpawn?.sshConnectionId ??
    tab.terminalSpawn?.create.sshConnectionId
  if (!connId || !settings) return null
  return settings.connections.find((c) => c.id === connId) ?? null
}

function resolveBuiltinCommand(shell: BuiltinShellType): string {
  return BUILTIN_SHELL_EXECUTABLE[shell]
}

function pushRow(
  rows: TerminalTabPropertyRow[],
  labelKey: string,
  value: string | null | undefined,
  monospace = false,
): void {
  const trimmed = value?.trim()
  if (!trimmed) return
  rows.push({ labelKey, value: trimmed, monospace })
}

function pushRowOrNone(
  rows: TerminalTabPropertyRow[],
  labelKey: string,
  value: string | null | undefined,
  monospace = false,
): void {
  rows.push({
    labelKey,
    value: value?.trim() ? value.trim() : 'common.none',
    monospace,
  })
}

function displayCommand(command: string | null | undefined): string | null | undefined {
  if (command === TELNET_BRIDGE_SENTINEL) return 'telnet-client bridge'
  return command
}

export function buildTerminalTabPropertyRows(
  tab: AppTab,
  settings: AppSettings | null,
  terminalCwds: Record<string, string>,
): TerminalTabPropertyRow[] {
  const rows: TerminalTabPropertyRow[] = []
  const spawn = resolveTabTerminalSpawn(tab, settings)
  const create = spawn?.create
  const connection = resolveTabConnection(tab, settings) ?? getSshConnection(settings, tab.sshConnectionId)

  pushRow(rows, 'tab.terminalPropertiesCreatedAt', tab.createdAt)
  pushRow(rows, 'tab.terminalPropertiesTitleLabel', getTabDisplayTitle(tab))
  if (tab.customTitle?.trim() && tab.customTitle.trim() !== tab.title) {
    pushRow(rows, 'tab.terminalPropertiesDefaultTitle', tab.title)
  }

  const shell = create?.shell ?? tab.shell
  if (shell === 'ssh' || connection?.type === 'ssh') {
    pushRow(rows, 'tab.terminalPropertiesType', 'settings.connections.typeSsh')
    pushRow(rows, 'tab.terminalPropertiesConnectionName', connection?.name ?? create?.name)
    const host = connection?.sshHost ?? connection?.command
    pushRow(rows, 'tab.terminalPropertiesHost', host)
    if (connection?.sshPort != null) {
      pushRow(rows, 'tab.terminalPropertiesPort', String(connection.sshPort))
    }
    pushRow(rows, 'tab.terminalPropertiesUsername', connection?.sshUser)
    if (connection?.sshAuth === 'publickey') {
      pushRow(rows, 'tab.terminalPropertiesAuthMethod', 'settings.connections.authPublicKey')
    } else if (connection?.sshAuth === 'password') {
      pushRow(rows, 'tab.terminalPropertiesAuthMethod', 'settings.connections.authPassword')
    }
    if (connection?.sshGroup?.trim()) {
      pushRow(rows, 'tab.terminalPropertiesGroup', connection.sshGroup)
    }
    if (connection?.sshDynamicPassword) {
      pushRow(rows, 'tab.terminalPropertiesDynamicPassword', 'tab.terminalPropertiesYes')
    }
    pushRowOrNone(rows, 'tab.terminalPropertiesCommand', displayCommand(create?.command ?? 'ssh'), true)
    pushRowOrNone(rows, 'tab.terminalPropertiesArgs', formatArgs(create?.args), true)
  } else if (connection?.type === 'wsl') {
    pushRow(rows, 'tab.terminalPropertiesType', 'settings.connections.typeWsl')
    pushRow(rows, 'tab.terminalPropertiesConnectionName', connection.name)
    pushRow(rows, 'tab.terminalPropertiesWslDistro', connection.wslDistro?.trim() || 'settings.connections.wslDefaultDistro')
    pushRowOrNone(rows, 'tab.terminalPropertiesCommand', displayCommand(create?.command ?? 'wsl.exe'), true)
    pushRowOrNone(rows, 'tab.terminalPropertiesArgs', formatArgs(create?.args), true)
  } else if (connection?.type === 'telnet') {
    pushRow(rows, 'tab.terminalPropertiesType', 'settings.connections.typeTelnet')
    pushRow(rows, 'tab.terminalPropertiesConnectionName', connection.name)
    pushRow(rows, 'tab.terminalPropertiesHost', connection.telnetHost ?? connection.command)
    if (connection.telnetPort != null) {
      pushRow(rows, 'tab.terminalPropertiesPort', String(connection.telnetPort))
    }
    pushRowOrNone(rows, 'tab.terminalPropertiesCommand', displayCommand(create?.command), true)
    pushRowOrNone(rows, 'tab.terminalPropertiesArgs', formatArgs(create?.args), true)
  } else if (shell === 'custom' || connection?.type === 'command') {
    pushRow(rows, 'tab.terminalPropertiesType', 'settings.connections.typeCommand')
    pushRow(rows, 'tab.terminalPropertiesConnectionName', connection?.name ?? create?.name)
    pushRowOrNone(
      rows,
      'tab.terminalPropertiesCommand',
      displayCommand(create?.command ?? connection?.command),
      true,
    )
    pushRowOrNone(
      rows,
      'tab.terminalPropertiesArgs',
      formatArgs(create?.args ?? connection?.args),
      true,
    )
  } else if (shell && shell !== 'ssh' && shell !== 'custom') {
    const builtin = shell as BuiltinShellType
    pushRow(rows, 'tab.terminalPropertiesType', BUILTIN_SHELL_LABELS[builtin] ?? shell)
    pushRowOrNone(rows, 'tab.terminalPropertiesCommand', displayCommand(resolveBuiltinCommand(builtin)), true)
    pushRowOrNone(rows, 'tab.terminalPropertiesArgs', formatArgs(create?.args), true)
    if (create?.elevated) {
      pushRow(rows, 'tab.terminalPropertiesElevated', 'tab.terminalPropertiesYes')
    }
  }

  const activeTerminalId = getActiveTerminalId(tab)
  const cwd =
    (activeTerminalId ? terminalCwds[activeTerminalId] : undefined) ?? create?.cwd
  pushRow(rows, 'tab.terminalPropertiesCwd', cwd, true)

  const splitCount = getSplitPanes(tab).length
  if (splitCount > 1) {
    pushRow(rows, 'tab.terminalPropertiesSplitPanes', String(splitCount))
  }

  if (tab.sshDeferredConnect) {
    pushRow(rows, 'tab.terminalPropertiesDeferredConnect', 'tab.terminalPropertiesYes')
  }

  return rows
}

export function formatTerminalPropertyCreatedAt(
  iso: string | undefined,
  locale: string,
): string | null {
  if (!iso?.trim()) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const dateLocale =
    locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US'
  return new Date(ms).toLocaleString(dateLocale)
}
