export const DEFAULT_TERMINAL_BACKGROUND_OPACITY = 100
export const MIN_TERMINAL_BACKGROUND_OPACITY = 0
export const MAX_TERMINAL_BACKGROUND_OPACITY = 100

const BACKGROUND_IMAGE_EXT_RE = /^[a-z0-9]+$/i

export function normalizeTerminalBackgroundOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_TERMINAL_BACKGROUND_OPACITY
  return Math.min(
    MAX_TERMINAL_BACKGROUND_OPACITY,
    Math.max(MIN_TERMINAL_BACKGROUND_OPACITY, Math.round(n)),
  )
}

/** 不含点号的扩展名，如 png、jpg */
export function normalizeTerminalBackgroundImageExt(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const ext = value.trim().replace(/^\./, '').toLowerCase()
  if (!ext || !BACKGROUND_IMAGE_EXT_RE.test(ext)) return undefined
  return ext
}
