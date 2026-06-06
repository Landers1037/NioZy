import { useMemo } from 'react'
import type { GraphLayout } from '@/lib/git-graph-layout'
import {
  GRAPH_LANE_WIDTH,
  GRAPH_NODE_RADIUS,
  GRAPH_ROW_HEIGHT,
  laneColor,
} from '@/lib/git-graph-layout'

interface GitGraphCanvasProps {
  layout: GraphLayout
  accentColor?: string
  className?: string
}

function columnCenter(column: number): number {
  return column * GRAPH_LANE_WIDTH + GRAPH_LANE_WIDTH / 2
}

export function GitGraphCanvas({ layout, accentColor, className }: GitGraphCanvasProps) {
  const { items, columnCount, paths } = layout
  const width = Math.max(columnCount * GRAPH_LANE_WIDTH, GRAPH_LANE_WIDTH)
  const height = Math.max(items.length * GRAPH_ROW_HEIGHT, GRAPH_ROW_HEIGHT)

  const pathElements = useMemo(() => {
    return paths.map((path, index) => {
      const x1 = columnCenter(path.fromColumn)
      const y1 = path.fromDisplayIndex * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2
      const x2 = columnCenter(path.toColumn)
      const y2 = path.toDisplayIndex * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2
      const color = laneColor(path.fromColumn, accentColor)

      if (path.fromColumn === path.toColumn) {
        return (
          <line
            key={`${path.kind}-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={2}
          />
        )
      }

      const midY = (y1 + y2) / 2
      const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
      return (
        <path
          key={`${path.kind}-${index}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      )
    })
  }, [paths, accentColor])

  if (items.length === 0) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {pathElements}
      {items.map((item) => {
        const cx = columnCenter(item.column)
        const cy = item.displayIndex * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2
        const color = laneColor(item.column, accentColor)
        const r = item.isMerge ? GRAPH_NODE_RADIUS + 1 : GRAPH_NODE_RADIUS
        return (
          <g key={item.row.sha}>
            <circle cx={cx} cy={cy} r={r + 2} fill="var(--background)" />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              stroke={color}
              strokeWidth={item.isMerge ? 2 : 0}
              fillOpacity={item.isMerge ? 0.15 : 1}
            />
            {item.isMerge ? (
              <circle cx={cx} cy={cy} r={r - 2} fill={color} />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function graphCanvasWidth(layout: GraphLayout): number {
  return Math.max(layout.columnCount * GRAPH_LANE_WIDTH, GRAPH_LANE_WIDTH)
}
