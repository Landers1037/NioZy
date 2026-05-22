import type { TFunction } from 'i18next'
import type { AppSettings, TerminalCursorStyle } from '../../electron/shared/api-types'
import { normalizeTerminalCursorStyle } from '../../electron/shared/terminal-cursor'

export const CURSOR_STYLE_VALUES: TerminalCursorStyle[] = ['block', 'underline', 'bar']

export function getCursorStyleOptions(t: TFunction) {
  return CURSOR_STYLE_VALUES.map((value) => ({
    value,
    label: t(`cursor.${value}`),
  }))
}

export function getTerminalCursorOptions(
  terminal: AppSettings['terminal'] | undefined,
): { cursorBlink: boolean; cursorStyle: TerminalCursorStyle } {
  return {
    cursorBlink: terminal?.cursorBlink ?? true,
    cursorStyle: normalizeTerminalCursorStyle(terminal?.cursorStyle),
  }
}

export { normalizeTerminalCursorStyle, type TerminalCursorStyle } from '../../electron/shared/terminal-cursor'
