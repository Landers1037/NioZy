import type { Terminal } from '@xterm/xterm'
import type { AppShortcuts } from '../../electron/shared/shortcuts'
import { getElectronAPI } from '@/lib/electron-client'
import { matchAccelerator } from '@/lib/shortcut-utils'
import i18n from '@/lib/i18n'
import { toast } from 'sonner'

/** 在 xterm 获得焦点时处理终端快捷键；返回 true 表示已处理。 */
export function handleTerminalKeyboardShortcut(
  term: Terminal,
  terminalId: string,
  app: AppShortcuts['app'],
  event: KeyboardEvent,
): boolean {
  if (event.type !== 'keydown') return false

  if (matchAccelerator(app.copyToClipboard, event)) {
    event.preventDefault()
    const text = term.getSelection()
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
    event.preventDefault()
    term.clear()
    return true
  }

  return false
}

/** 右键：有选区则复制，无选区则粘贴。须在捕获阶段调用以阻止 xterm 默认右键行为。 */
export function handleTerminalRightClick(
  term: Terminal,
  terminalId: string,
  event: MouseEvent,
): void {
  event.preventDefault()
  event.stopPropagation()

  const selection = term.getSelection()
  if (selection) {
    void navigator.clipboard.writeText(selection)
    return
  }

  void navigator.clipboard.readText().then((text) => {
    if (text) getElectronAPI().terminal.write(terminalId, text)
  })
}
