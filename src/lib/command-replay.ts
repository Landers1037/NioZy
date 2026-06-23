import type { CommandReplayItem } from '../../electron/shared/command-replay'
import type { AppSettings } from '../../electron/shared/api-types'
import { useAppStore } from '@/stores/app-store'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { isAttachPtyRenderMode } from '@/lib/attach-pty-render'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { focusActiveTerminal } from '@/lib/terminal-focus'
import { getElectronAPI } from '@/lib/electron-client'

export function getCommandReplays(settings: AppSettings | null | undefined): CommandReplayItem[] {
  return settings?.shell?.commandReplays ?? []
}

export interface ActiveReplayContext {
  tabId: string
  terminalId: string
}

/** 当前可录制/重放的终端 Tab（含工作区与 Attach-PTY 已提交终端） */
export function getActiveReplayContext(): ActiveReplayContext | undefined {
  const { tabs, activeTabId, settings } = useAppStore.getState()
  if (!activeTabId) return undefined

  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return undefined

  if (tab.type === 'terminal') {
    if (isAttachPtyRenderMode(settings)) {
      const committed = useAttachPtySessionStore.getState().committed
      if (committed?.tabId === tab.id) {
        return { tabId: tab.id, terminalId: committed.terminalId }
      }
    }
    const terminalId = getActiveTerminalId(tab)
    if (!terminalId) return undefined
    return { tabId: tab.id, terminalId }
  }

  if (tab.type === 'workspace') {
    const session = useWorkspaceStore.getState().sessions[tab.id]
    const terminalId = session?.terminalId ?? tab.terminalId
    if (!terminalId || session?.isStarted !== true) return undefined
    return { tabId: tab.id, terminalId }
  }

  return undefined
}

export function getActiveReplayTerminalId(): string | undefined {
  return getActiveReplayContext()?.terminalId
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
