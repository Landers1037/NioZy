export interface DrawingSettings {
  /** 开启后在侧栏显示 Excalidraw 入口 */
  excalidrawEnabled: boolean
  /** 开启后在侧栏显示 Draw.io 入口 */
  drawioEnabled: boolean
}

export const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  excalidrawEnabled: false,
  drawioEnabled: false,
}

export function normalizeDrawingSettings(value: unknown): DrawingSettings {
  const v = value && typeof value === 'object' ? (value as Partial<DrawingSettings>) : {}
  return {
    excalidrawEnabled: v.excalidrawEnabled === true,
    drawioEnabled: v.drawioEnabled === true,
  }
}
