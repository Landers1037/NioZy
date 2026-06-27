export const DEFAULT_TERMINAL_SCROLLBACK = 1_000
/** xterm Tab 显示宽度（列数），与常见编辑器 tabSize=4 对齐 */
export const DEFAULT_TERMINAL_TAB_STOP_WIDTH = 4
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

export function normalizeTerminalLigaturesEnabled(value: unknown): boolean {
  return value === true
}

export function normalizeRightClickCopyPaste(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

export function normalizeAdvancedRightClickMenu(value: unknown): boolean {
  return value === true
}

/** 右键复制/粘贴与高级右键菜单互斥；两者同时为 true 时保留复制/粘贴。 */
export function normalizeTerminalRightClickSettings(stored: {
  rightClickCopyPaste?: unknown
  advancedRightClickMenu?: unknown
}): { rightClickCopyPaste: boolean; advancedRightClickMenu: boolean } {
  const rightClickCopyPaste = normalizeRightClickCopyPaste(stored.rightClickCopyPaste)
  const advancedRightClickMenu = normalizeAdvancedRightClickMenu(stored.advancedRightClickMenu)
  if (rightClickCopyPaste && advancedRightClickMenu) {
    return { rightClickCopyPaste: true, advancedRightClickMenu: false }
  }
  return { rightClickCopyPaste, advancedRightClickMenu }
}

export function resolveRightClickSelectsWord(stored: {
  rightClickCopyPaste?: unknown
  advancedRightClickMenu?: unknown
}): boolean {
  const { rightClickCopyPaste, advancedRightClickMenu } = normalizeTerminalRightClickSettings(stored)
  return !rightClickCopyPaste && !advancedRightClickMenu
}

/** xterm.js 6+ DEC mode 2026 同步输出；Wterm 不支持 */
export function normalizeSynchronizedOutputEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}
