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
  return TERMINAL_THEMES[id]
}
