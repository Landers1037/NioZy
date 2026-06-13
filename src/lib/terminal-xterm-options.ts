import type { ITerminalOptions } from '@xterm/xterm'
import type { AppSettings } from '../../electron/shared/api-types'
import { resolveTerminalFontFamilyCSSValue } from '../../electron/shared/terminal-builtin-fonts'
import {
  DEFAULT_TERMINAL_SCROLLBACK,
  normalizeDrawBoldTextInBrightColors,
  normalizeTerminalScrollback,
  resolveRightClickSelectsWord,
} from '../../electron/shared/terminal-xterm'

export function buildTerminalOptions(
  terminal: AppSettings['terminal'] | undefined,
  theme: NonNullable<ITerminalOptions['theme']>,
  cursor: Pick<ITerminalOptions, 'cursorBlink' | 'cursorStyle'>,
  /** Unicode11 等 addon 需要访问 term.unicode 提案 API */
  allowProposedApi = false,
): ITerminalOptions {
  return {
    fontFamily: terminal ? resolveTerminalFontFamilyCSSValue(terminal) : 'Consolas',
    fontSize: terminal?.fontSize ?? 13,
    fontWeight: terminal?.fontWeight,
    fontWeightBold: terminal?.fontWeightBold,
    theme,
    scrollback: normalizeTerminalScrollback(terminal?.scrollback ?? DEFAULT_TERMINAL_SCROLLBACK),
    drawBoldTextInBrightColors: normalizeDrawBoldTextInBrightColors(
      terminal?.drawBoldTextInBrightColors,
    ),
    rightClickSelectsWord: resolveRightClickSelectsWord(terminal ?? {}),
    macOptionClickForcesSelection: true,
    customGlyphs: true,
    lineHeight: 1,
    letterSpacing: 0,
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
  term.options.rightClickSelectsWord = resolveRightClickSelectsWord(terminal)
  term.options.macOptionClickForcesSelection = true
  term.options.fontWeight = terminal.fontWeight
  term.options.fontWeightBold = terminal.fontWeightBold
  term.options.customGlyphs = true
  term.options.lineHeight = 1
  term.options.letterSpacing = 0
}
