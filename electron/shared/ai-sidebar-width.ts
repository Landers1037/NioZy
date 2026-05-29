export type AiSidebarWidthPreset = 'narrow' | 'default' | 'wide'

export const AI_SIDEBAR_WIDTH_PRESETS: AiSidebarWidthPreset[] = ['narrow', 'default', 'wide']

export const AI_SIDEBAR_WIDTH_PX: Record<AiSidebarWidthPreset, number> = {
  narrow: 360,
  default: 480,
  wide: 640,
}

export const DEFAULT_AI_SIDEBAR_WIDTH_PRESET: AiSidebarWidthPreset = 'default'

export function normalizeAiSidebarWidthPreset(value: unknown): AiSidebarWidthPreset {
  return AI_SIDEBAR_WIDTH_PRESETS.includes(value as AiSidebarWidthPreset)
    ? (value as AiSidebarWidthPreset)
    : DEFAULT_AI_SIDEBAR_WIDTH_PRESET
}

export function resolveAiSidebarWidthPx(preset: AiSidebarWidthPreset): number {
  return AI_SIDEBAR_WIDTH_PX[preset]
}
