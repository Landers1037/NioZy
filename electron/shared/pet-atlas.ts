/** Petdex / Codex 精灵图规格：1536×1872，8×9 网格，单帧 192×208 */
export const PET_ATLAS = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
} as const

/** 桌面宠物显示缩放范围（相对 atlas 单帧） */
export const PET_DISPLAY_SCALE_MIN = 0.25
export const PET_DISPLAY_SCALE_MAX = 2
/** 滑块步进（1%），保证 25% 等边界值可对齐 */
export const PET_DISPLAY_SCALE_STEP = 0.01
export const PET_DISPLAY_SCALE_DEFAULT = 0.5

/** @deprecated 使用 PET_DISPLAY_SCALE_DEFAULT */
export const PET_DISPLAY_SCALE = PET_DISPLAY_SCALE_DEFAULT

export const PET_DISPLAY_WIDTH = Math.round(PET_ATLAS.cellWidth * PET_DISPLAY_SCALE_DEFAULT)
export const PET_DISPLAY_HEIGHT = Math.round(PET_ATLAS.cellHeight * PET_DISPLAY_SCALE_DEFAULT)

export function normalizePetDisplayScale(stored: number | undefined): number {
  if (typeof stored !== 'number' || !Number.isFinite(stored)) {
    return PET_DISPLAY_SCALE_DEFAULT
  }
  const steps = Math.round((stored - PET_DISPLAY_SCALE_MIN) / PET_DISPLAY_SCALE_STEP)
  const stepped = PET_DISPLAY_SCALE_MIN + steps * PET_DISPLAY_SCALE_STEP
  const clamped = Math.min(PET_DISPLAY_SCALE_MAX, Math.max(PET_DISPLAY_SCALE_MIN, stepped))
  return Math.round(clamped * 100) / 100
}

export function getPetDisplayDimensions(scale: number): { width: number; height: number } {
  const normalized = normalizePetDisplayScale(scale)
  return {
    width: Math.round(PET_ATLAS.cellWidth * normalized),
    height: Math.round(PET_ATLAS.cellHeight * normalized),
  }
}
