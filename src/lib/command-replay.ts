import type { CommandReplayItem } from '../../electron/shared/command-replay'
import type { AppSettings } from '../../electron/shared/api-types'
import { useAppStore } from '@/stores/app-store'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { focusActiveTerminal } from '@/lib/terminal-focus'
import { getElectronAPI } from '@/lib/electron-client'
export function getCommandReplays(settings: AppSettings | null | undefined): CommandReplayItem[] {
  return settings?.shell?.commandReplays ?? []
}

export function getActiveReplayTerminalId(): string | undefined {
  const { tabs, activeTabId } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal')
  if (!tab) return undefined
  return getActiveTerminalId(tab)
}

/**
 * 将多行命令转为可顺序执行的 PTY 输入。
 * Windows shell 需用 \\r 提交每一行；仅用 \\n 连接时最后一行的 \\r 会跳过前面的行。
 */
export function prepareCommandForReplay(command: string): string {
  if (!command) return '\r'

  const lines = command
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  if (lines.length === 0) return '\r'

  return lines.map((line) => `${line.replace(/\r/g, '')}\r`).join('')
}

export function replayCommandToTerminal(command: string): boolean {
  const terminalId = getActiveReplayTerminalId()
  if (!terminalId) return false
  getElectronAPI().terminal.write(terminalId, prepareCommandForReplay(command))
  window.requestAnimationFrame(() => {
    focusActiveTerminal()
  })
  return true
}
