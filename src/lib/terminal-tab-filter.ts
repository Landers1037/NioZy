import {
  BUILTIN_SHELL_EXECUTABLE,
  BUILTIN_SHELL_LABELS,
  type BuiltinShellType,
} from '../../electron/shared/builtin-shells'
import type { AppSettings } from '../../electron/shared/api-types'
import type { AppTab } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { getSshConnection } from '@/lib/ssh-connection'
import { getActiveTerminalId, resolveTabTerminalSpawn } from '@/lib/terminal-tab-utils'

function formatArgs(args: string[] | undefined): string | null {
  if (!args || args.length === 0) return null
  return args.join(' ')
}

function pushText(texts: string[], value: string | null | undefined): void {
  const trimmed = value?.trim()
  if (trimmed) texts.push(trimmed)
}

/** 收集终端 Tab 的可搜索文本（标题、命令、连接信息等） */
export function buildTerminalTabSearchTexts(
  tab: AppTab,
  settings: AppSettings | null,
  terminalCwds: Record<string, string>,
): string[] {
  const texts: string[] = []
  pushText(texts, getTabDisplayTitle(tab))
  pushText(texts, tab.title)
  pushText(texts, tab.customTitle)

  const spawn = resolveTabTerminalSpawn(tab, settings)
  const create = spawn?.create
  const connId =
    tab.sshConnectionId ??
    tab.terminalSpawn?.sshConnectionId ??
    tab.terminalSpawn?.create.sshConnectionId
  const connection =
    (connId && settings ? settings.connections.find((c) => c.id === connId) : null) ??
    getSshConnection(settings, tab.sshConnectionId)

  pushText(texts, connection?.name)
  pushText(texts, connection?.command)
  pushText(texts, connection?.sshHost)
  pushText(texts, connection?.sshUser)
  pushText(texts, connection?.telnetHost)
  pushText(texts, connection?.wslDistro)

  const shell = create?.shell ?? tab.shell
  if (shell && shell !== 'ssh' && shell !== 'custom') {
    const builtin = shell as BuiltinShellType
    pushText(texts, BUILTIN_SHELL_LABELS[builtin])
    pushText(texts, BUILTIN_SHELL_EXECUTABLE[builtin])
  }

  pushText(texts, create?.command)
  pushText(texts, create?.name)
  pushText(texts, formatArgs(create?.args))
  pushText(texts, formatArgs(connection?.args))

  const activeTerminalId = getActiveTerminalId(tab)
  pushText(
    texts,
    (activeTerminalId ? terminalCwds[activeTerminalId] : undefined) ?? create?.cwd,
  )

  return texts
}

export function matchesTerminalTabFilter(
  tab: AppTab,
  query: string,
  settings: AppSettings | null,
  terminalCwds: Record<string, string>,
): boolean {
  if (tab.type !== 'terminal') return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return buildTerminalTabSearchTexts(tab, settings, terminalCwds).some((text) =>
    text.toLowerCase().includes(q),
  )
}
