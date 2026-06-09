import type { GitGraphRow } from '../../electron/shared/repo-types'

export const GRAPH_LANE_COLORS = [
  '#0669f7',
  '#2ece9d',
  '#f2ca33',
  '#c517b6',
  '#f25d2e',
  '#7bd938',
  '#15a0bf',
  '#d90171',
] as const

export const GRAPH_ROW_HEIGHT = 36
/** 提交列表表头高度，须与 GitCommitList 表头一致，用于时间线纵向对齐 */
export const GRAPH_LIST_HEADER_HEIGHT = 33
export const GRAPH_LANE_WIDTH = 18
export const GRAPH_NODE_RADIUS = 5

export interface GraphLayoutItem {
  row: GitGraphRow
  displayIndex: number
  column: number
  isMerge: boolean
}

export interface GraphLayoutPath {
  fromDisplayIndex: number
  toDisplayIndex: number
  fromColumn: number
  toColumn: number
  kind: 'primary' | 'merge'
}

export interface GraphLayout {
  items: GraphLayoutItem[]
  columnCount: number
  paths: GraphLayoutPath[]
}

/** 按时间从旧到新分配 lane，再按展示顺序（新→旧）渲染 */
export function computeGraphLayout(rows: GitGraphRow[]): GraphLayout {
  if (rows.length === 0) {
    return { items: [], columnCount: 1, paths: [] }
  }

  const oldestFirst = [...rows].reverse()
  const chronIndexBySha = new Map(oldestFirst.map((row, index) => [row.sha, index]))
  const displayIndexBySha = new Map(rows.map((row, index) => [row.sha, index]))

  const lanes: Array<string | null> = []
  const columnBySha = new Map<string, number>()
  const paths: GraphLayoutPath[] = []

  const ensureLane = (index: number) => {
    while (lanes.length <= index) lanes.push(null)
  }

  const takeFreeLane = () => {
    const existing = lanes.findIndex((lane) => lane === null)
    if (existing >= 0) return existing
    lanes.push(null)
    return lanes.length - 1
  }

  oldestFirst.forEach((row) => {
    const parents = row.parents.filter((sha) => chronIndexBySha.has(sha))
    let column: number

    if (parents.length === 0) {
      column = takeFreeLane()
    } else {
      const parentColumn = columnBySha.get(parents[0])
      column = parentColumn ?? takeFreeLane()
    }

    ensureLane(column)
    columnBySha.set(row.sha, column)
    lanes[column] = row.sha

    const fromDisplay = displayIndexBySha.get(row.sha)!
    parents.forEach((parentSha, parentIndex) => {
      const toDisplay = displayIndexBySha.get(parentSha)
      if (toDisplay === undefined) return
      const toColumn = columnBySha.get(parentSha) ?? column
      paths.push({
        fromDisplayIndex: fromDisplay,
        toDisplayIndex: toDisplay,
        fromColumn: column,
        toColumn,
        kind: parentIndex === 0 ? 'primary' : 'merge',
      })
      if (parentIndex > 0) {
        ensureLane(toColumn)
        lanes[toColumn] = parentSha
      }
    })

    lanes[column] = parents[0] ?? null
  })

  const columnCount = Math.max(
    1,
    lanes.length,
    ...Array.from(columnBySha.values(), (col) => col + 1),
  )

  const items = rows.map((row, displayIndex) => ({
    row,
    displayIndex,
    column: columnBySha.get(row.sha) ?? 0,
    isMerge: row.parents.length >= 2,
  }))

  return { items, columnCount, paths }
}

export function laneColor(column: number, accent?: string): string {
  if (column === 0 && accent) return accent
  return GRAPH_LANE_COLORS[column % GRAPH_LANE_COLORS.length]
}

export function commitSubject(message: string): string {
  const line = message.split('\n')[0]?.trim()
  return line || message.trim()
}
