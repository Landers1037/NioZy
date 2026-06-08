/** Petdex / Codex 精灵图规格：1536×1872，8×9 网格，单帧 192×208 */
export const PET_ATLAS = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
} as const

/** 桌面宠物显示缩放（相对 atlas 单帧） */
export const PET_DISPLAY_SCALE = 0.5

export const PET_DISPLAY_WIDTH = Math.round(PET_ATLAS.cellWidth * PET_DISPLAY_SCALE)
export const PET_DISPLAY_HEIGHT = Math.round(PET_ATLAS.cellHeight * PET_DISPLAY_SCALE)
