import type { Terminal } from '@xterm/xterm'
import type { TerminalEmulator } from '../../electron/shared/experimental-settings'
import type { AppTab } from '@/stores/app-store'
import { handleTerminalTabNavigationShortcut } from '@/lib/app-shortcut-actions'
import {
  handleTerminalCopyWhenSelection,
  handleTerminalKeyboardShortcut,
  handleTerminalModifiedEnterKey,
} from '@/lib/terminal-shortcut-actions'
import { tryHandleSshReconnectEnter } from '@/lib/ssh-reconnect-actions'
import { DEFAULT_SHELL_SETTINGS } from '../../electron/shared/shell-settings'
import { useAppStore } from '@/stores/app-store'

export interface TerminalCustomKeyContext {
  getTab: () => AppTab
  getTerminalId: () => string | null
  term: Terminal
}

/** 无修饰键的可打印字符：无需走快捷键/Store 分支 */
function isPlainPrintableKey(event: KeyboardEvent): boolean {
  return (
    event.type === 'keydown' &&
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
}

/**
 * xterm.js 语义：返回 true 表示交由终端继续处理该按键，false 表示已消费。
 * ghostty-web 语义相反（true = 阻止终端处理），见 attachTerminalCustomKeyHandler。
 */
export function resolveTerminalCustomKeyEvent(
  event: KeyboardEvent,
  ctx: TerminalCustomKeyContext,
): boolean {
  if (isPlainPrintableKey(event)) return true

  const terminalId = ctx.getTerminalId()
  if (!terminalId) return true

  if (handleTerminalTabNavigationShortcut(event)) return false

  if (tryHandleSshReconnectEnter(ctx.getTab(), terminalId, event)) {
    return false
  }

  const shell = useAppStore.getState().settings?.shell ?? DEFAULT_SHELL_SETTINGS
  if (handleTerminalModifiedEnterKey(terminalId, event, shell.shiftEnterNewline)) {
    return false
  }

  const shortcuts = useAppStore.getState().settings?.shortcuts.app
  if (handleTerminalCopyWhenSelection(event, ctx.term)) return false
  if (!shortcuts) return true

  const handled = handleTerminalKeyboardShortcut(terminalId, shortcuts, event, ctx.term)
  return !handled
}

export function attachTerminalCustomKeyHandler(
  term: Terminal,
  emulator: TerminalEmulator,
  ctx: TerminalCustomKeyContext,
): void {
  term.attachCustomKeyEventHandler((event) => {
    const xtermStyle = resolveTerminalCustomKeyEvent(event, ctx)
    return emulator === 'ghostty' ? !xtermStyle : xtermStyle
  })
}
