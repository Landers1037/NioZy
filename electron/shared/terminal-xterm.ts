export const DEFAULT_TERMINAL_SCROLLBACK = 1_000
export const MIN_TERMINAL_SCROLLBACK = 0
export const MAX_TERMINAL_SCROLLBACK = 100_000

export function normalizeTerminalScrollback(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : DEFAULT_TERMINAL_SCROLLBACK
  return Math.min(MAX_TERMINAL_SCROLLBACK, Math.max(MIN_TERMINAL_SCROLLBACK, Math.round(n)))
}

export function normalizeDrawBoldTextInBrightColors(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

export function normalizeRightClickCopyPaste(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

/** xterm.js 6+ DEC mode 2026 同步输出；Wterm 不支持 */
export function normalizeSynchronizedOutputEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}
