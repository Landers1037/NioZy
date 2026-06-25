/** 与 niozy-mux-core `GridLayout::compute` 保持一致的合成布局（用于鼠标命中 pane） */

export interface MuxGridRect {
  col: number
  row: number
  cols: number
  rows: number
}

export type MuxGridPaneCount = 1 | 2 | 4

export function computeMuxGridLayout(
  screenCols: number,
  screenRows: number,
  paneCount: MuxGridPaneCount,
): MuxGridRect[] {
  const count = paneCount === 1 ? 1 : paneCount === 2 ? 2 : 4
  const panes: MuxGridRect[] = [
    { col: 0, row: 0, cols: 0, rows: 0 },
    { col: 0, row: 0, cols: 0, rows: 0 },
    { col: 0, row: 0, cols: 0, rows: 0 },
    { col: 0, row: 0, cols: 0, rows: 0 },
  ]

  if (count === 1) {
    panes[0] = { col: 0, row: 0, cols: screenCols, rows: screenRows }
  } else if (count === 2) {
    const innerCols = Math.max(2, screenCols - 1)
    const left = Math.max(1, Math.floor(innerCols / 2))
    const right = Math.max(1, innerCols - left)
    panes[0] = { col: 0, row: 0, cols: left, rows: screenRows }
    panes[1] = {
      col: left + 1,
      row: 0,
      cols: right,
      rows: screenRows,
    }
  } else {
    const innerCols = Math.max(2, screenCols - 1)
    const innerRows = Math.max(2, screenRows - 1)
    const left = Math.max(1, Math.floor(innerCols / 2))
    const right = Math.max(1, innerCols - left)
    const top = Math.max(1, Math.floor(innerRows / 2))
    const bottom = Math.max(1, innerRows - top)
    panes[0] = { col: 0, row: 0, cols: left, rows: top }
    panes[1] = {
      col: left + 1,
      row: 0,
      cols: right,
      rows: top,
    }
    panes[2] = {
      col: 0,
      row: top + 1,
      cols: left,
      rows: bottom,
    }
    panes[3] = {
      col: left + 1,
      row: top + 1,
      cols: right,
      rows: bottom,
    }
  }

  return panes
}

export function paneIndexAtCell(
  panes: MuxGridRect[],
  activeCount: number,
  col: number,
  row: number,
): number {
  for (let i = 0; i < activeCount; i++) {
    const r = panes[i]
    if (col >= r.col && col < r.col + r.cols && row >= r.row && row < r.row + r.rows) {
      return i
    }
  }
  return 0
}
