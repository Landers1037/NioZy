import type { ITheme } from '@xterm/xterm'
import type { AppSettings } from '../../electron/shared/api-types'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import { getElectronAPI } from '@/lib/electron-client'

const MIN_TERMINAL_CELL_BG_ALPHA_WITH_IMAGE = 0.9

export function hasTerminalBackgroundImage(
  terminal: AppSettings['terminal'] | undefined,
): boolean {
  return !!terminal?.backgroundImageExt
}

export function getTerminalBackgroundOpacity(
  terminal: AppSettings['terminal'] | undefined,
): number {
  return terminal?.backgroundOpacity ?? 100
}

export function getTerminalChromeBackgroundColor(
  terminal: AppSettings['terminal'] | undefined,
): string {
  return resolveTerminalTheme(terminal?.colorScheme ?? 'atom').background ?? '#101419'
}

export function applyAlphaToColor(color: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha))
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex
    if (full.length < 6) return color
    const r = Number.parseInt(full.slice(0, 2), 16)
    const g = Number.parseInt(full.slice(2, 4), 16)
    const b = Number.parseInt(full.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${clamped})`
  }
  return color
}

/** 有背景图时单元格底色 alpha：保持较高不透明度，避免字形在透明/WebGL 合成下发糊 */
export function getTerminalCellBackgroundAlpha(
  terminal: AppSettings['terminal'] | undefined,
): number {
  if (!hasTerminalBackgroundImage(terminal)) return 1
  const imageOpacity = getTerminalBackgroundOpacity(terminal) / 100
  return Math.max(
    MIN_TERMINAL_CELL_BG_ALPHA_WITH_IMAGE,
    0.98 - imageOpacity * 0.08,
  )
}

export function getTerminalCellBackgroundColor(
  terminal: AppSettings['terminal'] | undefined,
): string {
  const bg = getTerminalChromeBackgroundColor(terminal)
  if (!hasTerminalBackgroundImage(terminal)) return bg
  return applyAlphaToColor(bg, getTerminalCellBackgroundAlpha(terminal))
}

/** 有背景图时为 xterm 使用半透明单元格底色（非全透明），兼顾壁纸与字形清晰度 */
export function resolveTerminalThemeWithBackground(
  schemeId: string,
  terminal: AppSettings['terminal'] | undefined,
): ITheme {
  const theme = resolveTerminalTheme(schemeId)
  const themed = hasTerminalBackgroundImage(terminal)
    ? {
        ...theme,
        background: getTerminalCellBackgroundColor(terminal),
      }
    : theme
  if (terminal?.hideCursor !== true) return themed
  return {
    ...themed,
    cursor: 'transparent',
    cursorAccent: 'transparent',
  }
}

export async function fetchTerminalBackgroundUrl(
  ext: string | undefined,
): Promise<string | null> {
  if (!ext) return null
  const res = await getElectronAPI().terminal.getBackgroundUrl(ext)
  return res.ok ? res.url : null
}
