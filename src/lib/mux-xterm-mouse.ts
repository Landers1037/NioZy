import type { Terminal } from '@xterm/xterm'

interface XtermCellDimensions {
  width: number
  height: number
}

/** 将鼠标事件映射到 xterm 单元格坐标（与 FitAddon 缩放后的 cell 尺寸一致） */
export function getXtermCellFromMouseEvent(
  term: Terminal,
  event: MouseEvent,
): { col: number; row: number } | null {
  const element = term.element
  if (!element) return null

  const rect = element.getBoundingClientRect()
  const cell = readXtermCellDimensions(term)
  if (!cell?.width || !cell?.height) return null

  const col = Math.floor((event.clientX - rect.left) / cell.width)
  const row = Math.floor((event.clientY - rect.top) / cell.height)
  if (col < 0 || row < 0 || col >= term.cols || row >= term.rows) return null
  return { col, row }
}

function readXtermCellDimensions(term: Terminal): XtermCellDimensions | null {
  type XtermCore = {
    _renderService?: { dimensions?: { css?: { cell?: XtermCellDimensions } } }
  }
  const core = (term as Terminal & { _core?: XtermCore })._core
  return core?._renderService?.dimensions?.css?.cell ?? null
}
