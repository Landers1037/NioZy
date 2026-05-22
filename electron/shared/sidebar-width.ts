/** 侧栏收起时的固定宽度（px） */
export const SIDEBAR_COLLAPSED_WIDTH = 56

export const DEFAULT_SIDEBAR_WIDTH = 260
export const MIN_SIDEBAR_WIDTH = 180
export const MAX_SIDEBAR_WIDTH = 480

export function normalizeSidebarWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SIDEBAR_WIDTH
  }
  return clampSidebarWidth(value)
}

export function clampSidebarWidth(width: number): number {
  return Math.round(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width)))
}
