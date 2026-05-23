import type { Terminal } from '@xterm/xterm'

/**
 * 交互式 CLI（Claude/Cursor agent 等）在备用屏常开启 xterm 鼠标追踪。
 * 点击输出区会把坐标发给 PTY，缓冲区光标会跳到点击处，与 TUI 自绘输入框光标错位。
 * 开启 shiftEnterNewline 时，在备用屏拦截普通左键，仅 refocus，不转发鼠标事件。
 */
export function handleInteractiveCliMouseDown(
  term: Terminal,
  event: MouseEvent,
  enabled: boolean,
): boolean {
  if (!enabled || event.type !== 'mousedown' || event.button !== 0) return false
  if (term.buffer.active.type !== 'alternate') return false
  if (event.shiftKey || event.altKey) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  term.focus()
  return true
}

export function applyInteractiveCliTerminalOptions(term: Terminal, shiftEnterNewline: boolean): void {
  term.options.altClickMovesCursor = !shiftEnterNewline
}
