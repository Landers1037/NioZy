import type { AppSettings, TerminalCursorStyle } from '../../electron/shared/api-types'
import { normalizeTerminalCursorStyle } from '../../electron/shared/terminal-cursor'

export const CURSOR_STYLE_OPTIONS: { value: TerminalCursorStyle; label: string }[] = [
  { value: 'block', label: '方块' },
  { value: 'underline', label: '下划线' },
  { value: 'bar', label: '竖线' },
]

export function getTerminalCursorOptions(
  terminal: AppSettings['terminal'] | undefined,
): { cursorBlink: boolean; cursorStyle: TerminalCursorStyle } {
  return {
    cursorBlink: terminal?.cursorBlink ?? true,
    cursorStyle: normalizeTerminalCursorStyle(terminal?.cursorStyle),
  }
}
