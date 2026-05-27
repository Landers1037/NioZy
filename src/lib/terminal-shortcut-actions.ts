import type { Terminal } from '@xterm/xterm'
import type { AppShortcuts } from '../../electron/shared/shortcuts'
import { getElectronAPI } from '@/lib/electron-client'
import { handleTerminalRightClickCopyPaste } from '@/lib/terminal-right-click'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import { matchAccelerator } from '@/lib/shortcut-utils'
import i18n from '@/lib/i18n'
import { toast } from 'sonner'

/** Kitty CSI u 修饰键位掩码 + 1（shift=2, alt=3, ctrl=5, super=9）。 */
function kittyEnterModifier(event: KeyboardEvent): number | null {
  let mask = 0
  if (event.shiftKey) mask |= 1
  if (event.altKey) mask |= 2
  if (event.ctrlKey) mask |= 4
  if (event.metaKey) mask |= 8
  return mask === 0 ? null : mask + 1
}

/**
 * xterm.js 未实现 Kitty 键盘协议时，修饰键+Enter 与裸 Enter 均发送 \\r。
 * 交互式 CLI（Claude/Cursor agent 等）依赖 \\x1b[13;Nu 区分换行与提交。
 */
export function handleTerminalModifiedEnterKey(
  terminalId: string,
  event: KeyboardEvent,
  enabled: boolean,
): boolean {
  if (!enabled || event.type !== 'keydown' || event.key !== 'Enter') return false

  const modifier = kittyEnterModifier(event)
  if (modifier === null) return false

  event.preventDefault()
  getElectronAPI().terminal.write(terminalId, `\x1b[13;${modifier}u`)
  return true
}

/**
 * 有选区时 Ctrl+C 复制到剪贴板（不发送 SIGINT）。
 * 无选区时不拦截，交由 shell 处理。
 */
export function handleTerminalCopyWhenSelection(
  event: KeyboardEvent,
  term?: Terminal | null,
): boolean {
  if (event.type !== 'keydown') return false
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return false
  if (event.key.toLowerCase() !== 'c') return false

  const text = readTerminalSelectionText(term)
  if (!text) return false

  event.preventDefault()
  void navigator.clipboard.writeText(text)
  return true
}

/** 在终端获得焦点时处理终端快捷键；返回 true 表示已处理。 */
export function handleTerminalKeyboardShortcut(
  terminalId: string,
  app: AppShortcuts['app'],
  event: KeyboardEvent,
  term?: Terminal | null,
): boolean {
  if (event.type !== 'keydown') return false

  if (matchAccelerator(app.copyToClipboard, event)) {
    event.preventDefault()
    const text = readTerminalSelectionText(term)
    if (text) void navigator.clipboard.writeText(text)
    else toast.message(i18n.t('toast.selectTerminalFirst'))
    return true
  }

  if (matchAccelerator(app.pasteFromClipboard, event)) {
    event.preventDefault()
    void navigator.clipboard.readText().then((text) => {
      if (text) getElectronAPI().terminal.write(terminalId, text)
    })
    return true
  }

  if (matchAccelerator(app.lineStart, event)) {
    event.preventDefault()
    getElectronAPI().terminal.write(terminalId, '\x01')
    return true
  }

  if (matchAccelerator(app.lineEnd, event)) {
    event.preventDefault()
    getElectronAPI().terminal.write(terminalId, '\x05')
    return true
  }

  if (matchAccelerator(app.clearTerminal, event)) {
    if (!term) return false
    event.preventDefault()
    term.clear()
    return true
  }

  return false
}

/** 右键：有选区则复制，无选区则粘贴。须在 mouseup（右键）或 contextmenu 时调用，避免 mousedown 清空选区。 */
export function handleTerminalRightClick(
  terminalId: string,
  event: MouseEvent,
  term?: Terminal | null,
): void {
  handleTerminalRightClickCopyPaste(
    terminalId,
    () => readTerminalSelectionText(term),
    event,
  )
}
