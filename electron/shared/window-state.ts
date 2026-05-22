export interface SavedWindowState {
  width: number
  height: number
  x: number
  y: number
  isMaximized: boolean
}

const MIN_WIDTH = 800
const MIN_HEIGHT = 500

export function normalizeSavedWindowState(value: unknown): SavedWindowState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const o = value as Record<string, unknown>
  const width =
    typeof o.width === 'number' && Number.isFinite(o.width)
      ? Math.max(MIN_WIDTH, Math.round(o.width))
      : undefined
  const height =
    typeof o.height === 'number' && Number.isFinite(o.height)
      ? Math.max(MIN_HEIGHT, Math.round(o.height))
      : undefined
  const x = typeof o.x === 'number' && Number.isFinite(o.x) ? Math.round(o.x) : undefined
  const y = typeof o.y === 'number' && Number.isFinite(o.y) ? Math.round(o.y) : undefined
  if (width === undefined || height === undefined || x === undefined || y === undefined) {
    return undefined
  }
  return {
    width,
    height,
    x,
    y,
    isMaximized: o.isMaximized === true,
  }
}
