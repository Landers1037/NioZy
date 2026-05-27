import type { ITerminalOptions } from '@xterm/xterm'
import type { AppSettings } from '../../electron/shared/api-types'
import {
  DEFAULT_TERMINAL_SCROLLBACK,
  normalizeDrawBoldTextInBrightColors,
  normalizeRightClickCopyPaste,
  normalizeTerminalScrollback,
} from '../../electron/shared/terminal-xterm'

export function buildTerminalOptions(
  terminal: AppSettings['terminal'] | undefined,
  theme: NonNullable<ITerminalOptions['theme']>,
  cursor: Pick<ITerminalOptions, 'cursorBlink' | 'cursorStyle'>,
  /** Unicode11 等 addon 需要访问 term.unicode 提案 API */
  allowProposedApi = false,
): ITerminalOptions {
  return {
    fontFamily: terminal?.fontFamily ?? 'Consolas',
    fontSize: terminal?.fontSize ?? 13,
    theme,
    scrollback: normalizeTerminalScrollback(terminal?.scrollback ?? DEFAULT_TERMINAL_SCROLLBACK),
    drawBoldTextInBrightColors: normalizeDrawBoldTextInBrightColors(
      terminal?.drawBoldTextInBrightColors,
    ),
    rightClickSelectsWord: !normalizeRightClickCopyPaste(terminal?.rightClickCopyPaste),
    macOptionClickForcesSelection: true,
    allowProposedApi,
    ...cursor,
  }
}

export function applyTerminalRuntimeOptions(
  term: import('@xterm/xterm').Terminal,
  terminal: AppSettings['terminal'],
): void {
  term.options.scrollback = normalizeTerminalScrollback(terminal.scrollback)
  term.options.drawBoldTextInBrightColors = normalizeDrawBoldTextInBrightColors(
    terminal.drawBoldTextInBrightColors,
  )
  term.options.rightClickSelectsWord = !normalizeRightClickCopyPaste(terminal.rightClickCopyPaste)
  term.options.macOptionClickForcesSelection = true
}
