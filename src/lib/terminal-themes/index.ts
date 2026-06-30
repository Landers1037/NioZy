import type { ITheme } from '@xterm/xterm'
import type { TerminalColorScheme } from '../../../electron/shared/terminal-color-schemes'
import {
  COLOR_SCHEME_OPTIONS,
  TERMINAL_COLOR_SCHEME_LABELS,
  normalizeTerminalColorScheme,
} from '../../../electron/shared/terminal-color-schemes'
import { TERMINAL_THEME_DEFINITIONS } from './definitions'

export type { TerminalColorScheme }
export { COLOR_SCHEME_OPTIONS, normalizeTerminalColorScheme }

export const TERMINAL_THEMES: Record<TerminalColorScheme, ITheme> = TERMINAL_THEME_DEFINITIONS

function hexToRgb(color: string): [number, number, number] | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return null
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function getRelativeLuminance(color: string): number | null {
  const rgb = hexToRgb(color)
  if (!rgb) return null
  const linear = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

function getContrastRatio(a: string, b: string): number {
  const lumA = getRelativeLuminance(a)
  const lumB = getRelativeLuminance(b)
  if (lumA === null || lumB === null) return 0
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

function getRgbDistance(a: string, b: string): number {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return Number.POSITIVE_INFINITY
  const dr = rgbA[0] - rgbB[0]
  const dg = rgbA[1] - rgbB[1]
  const db = rgbA[2] - rgbB[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function pickReadableThemeColor(
  background: string,
  candidates: Array<string | undefined>,
  avoid: string[],
  minContrast: number,
): string | undefined {
  let best: { color: string; contrast: number; distance: number } | null = null

  for (const candidate of candidates) {
    if (!candidate) continue
    const contrast = getContrastRatio(candidate, background)
    const distance = avoid.length
      ? Math.min(...avoid.map((color) => getRgbDistance(candidate, color)))
      : Number.POSITIVE_INFINITY
    if (contrast < minContrast || distance < 24) continue
    if (
      !best ||
      contrast > best.contrast ||
      (Math.abs(contrast - best.contrast) < 0.01 && distance > best.distance)
    ) {
      best = { color: candidate, contrast, distance }
    }
  }

  return best?.color
}

function normalizeThemeLegibility(theme: ITheme): ITheme {
  const background = theme.background
  const foreground = theme.foreground
  const blue = theme.blue
  const brightBlue = theme.brightBlue ?? blue
  if (!background || !foreground || !blue) return theme

  const avoidAccent = [blue, brightBlue].filter((color): color is string => Boolean(color))
  const neutralCandidates = [
    theme.brightBlack,
    theme.black,
    theme.white,
    theme.brightWhite,
    '#1f2937',
    '#e5e7eb',
  ]
  const whiteCandidates = [
    theme.white,
    theme.brightWhite,
    theme.foreground,
    theme.brightBlack,
    theme.black,
    '#1f2937',
    '#e5e7eb',
  ]

  const nextForeground =
    getContrastRatio(foreground, background) < 4.5 ||
    getRgbDistance(foreground, blue) < 24 ||
    (brightBlue && getRgbDistance(foreground, brightBlue) < 24)
      ? pickReadableThemeColor(background, neutralCandidates, avoidAccent, 4.5) ?? foreground
      : foreground

  const nextWhite =
    !theme.white || getContrastRatio(theme.white, background) < 3
      ? pickReadableThemeColor(background, whiteCandidates, [background], 3) ?? theme.white
      : theme.white

  const nextBrightWhite =
    !theme.brightWhite ||
    getContrastRatio(theme.brightWhite, background) < 3 ||
    getRgbDistance(theme.brightWhite, blue) < 24
      ? pickReadableThemeColor(background, whiteCandidates, [background, blue], 3) ??
        theme.brightWhite
      : theme.brightWhite

  return {
    ...theme,
    foreground: nextForeground,
    white: nextWhite,
    brightWhite: nextBrightWhite,
    cursor: theme.cursor === foreground ? nextForeground : theme.cursor,
  }
}

/** 16 色 ANSI 色板：标准 8 色 + 高亮 8 色 */
export function getThemePalette(theme: ITheme): string[] {
  const pick = (key: keyof ITheme, fallback: string) =>
    (theme[key] as string | undefined) ?? fallback

  return [
    pick('black', '#000000'),
    pick('red', '#ff0000'),
    pick('green', '#00ff00'),
    pick('yellow', '#ffff00'),
    pick('blue', '#0000ff'),
    pick('magenta', '#ff00ff'),
    pick('cyan', '#00ffff'),
    pick('white', '#ffffff'),
    pick('brightBlack', pick('black', '#808080')),
    pick('brightRed', pick('red', '#ff8080')),
    pick('brightGreen', pick('green', '#80ff80')),
    pick('brightYellow', pick('yellow', '#ffff80')),
    pick('brightBlue', pick('blue', '#8080ff')),
    pick('brightMagenta', pick('magenta', '#ff80ff')),
    pick('brightCyan', pick('cyan', '#80ffff')),
    pick('brightWhite', pick('white', '#ffffff')),
  ]
}

export function getColorSchemeLabel(id: TerminalColorScheme): string {
  return TERMINAL_COLOR_SCHEME_LABELS[id] ?? id
}

export function resolveTerminalTheme(schemeId: string): ITheme {
  const id = normalizeTerminalColorScheme(schemeId)
  return normalizeThemeLegibility(TERMINAL_THEMES[id])
}
