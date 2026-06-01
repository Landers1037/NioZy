import type { Terminal } from '@xterm/xterm'

const MAC_PLATFORMS = new Set(['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'])

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return MAC_PLATFORMS.has(navigator.platform)
}

/**
 * 与 xterm SelectionService.shouldForceSelection 一致。
 * Win/Linux：shiftKey；macOS：altKey（需 macOptionClickForcesSelection）
 */
export function isXtermForceSelectionMouseEvent(
  event: MouseEvent,
  macOptionClickForcesSelection = true,
): boolean {
  if (isMacPlatform()) {
    return event.altKey && macOptionClickForcesSelection
  }
  return event.shiftKey
}

/**
 * 鼠标坐标 → xterm 视口行列（0-based），基于 xterm-screen 尺寸。
 */
export function getViewportCellFromMouse(
  term: Terminal,
  event: MouseEvent,
): { col: number; row: number } | null {
  const screen = term.element?.querySelector('.xterm-screen')
  if (!screen) return null
  const rect = screen.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const relX = event.clientX - rect.left
  const relY = event.clientY - rect.top
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null
  const col = Math.floor((relX / rect.width) * term.cols)
  const row = Math.floor((relY / rect.height) * term.rows)
  return {
    col: Math.min(term.cols - 1, Math.max(0, col)),
    row: Math.min(term.rows - 1, Math.max(0, row)),
  }
}

/**
 * 从视口行计算缓冲区行（加上滚动偏移）。
 */
export function viewportRowToBufferRow(term: Terminal, viewportRow: number): number {
  return viewportRow + term.buffer.active.viewportY
}

/**
 * 通过 xterm 公开 API term.select() 将两个缓冲区位置设为选区。
 * term.select(col, row, length) 等效于 SelectionService.setSelection，
 * 直接操作内部 model，无需派发合成鼠标事件，完全绕过 PTY mouse reporting。
 */
export function applyXtermSelection(
  term: Terminal,
  startBufCol: number,
  startBufRow: number,
  endBufCol: number,
  endBufRow: number,
): void {
  const cols = term.cols
  let col: number
  let row: number
  let length: number

  if (startBufRow < endBufRow) {
    col = startBufCol
    row = startBufRow
    length = (endBufRow - startBufRow) * cols + (endBufCol - startBufCol)
  } else if (startBufRow > endBufRow) {
    col = endBufCol
    row = endBufRow
    length = (startBufRow - endBufRow) * cols + (startBufCol - endBufCol)
  } else {
    // 同一行
    col = Math.min(startBufCol, endBufCol)
    row = startBufRow
    length = Math.abs(endBufCol - startBufCol)
  }

  if (length <= 0) {
    term.clearSelection()
    return
  }

  term.select(col, row, length)
}
