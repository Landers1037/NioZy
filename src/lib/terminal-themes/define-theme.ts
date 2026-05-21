import type { ITheme } from '@xterm/xterm'

export interface TerminalThemeColors {
  background: string
  foreground: string
  cursor?: string
  selectionBackground?: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export function defineTerminalTheme(c: TerminalThemeColors): ITheme {
  return {
    background: c.background,
    foreground: c.foreground,
    cursor: c.cursor ?? c.foreground,
    selectionBackground: c.selectionBackground ?? c.brightBlack,
    black: c.black,
    red: c.red,
    green: c.green,
    yellow: c.yellow,
    blue: c.blue,
    magenta: c.magenta,
    cyan: c.cyan,
    white: c.white,
    brightBlack: c.brightBlack,
    brightRed: c.brightRed,
    brightGreen: c.brightGreen,
    brightYellow: c.brightYellow,
    brightBlue: c.brightBlue,
    brightMagenta: c.brightMagenta,
    brightCyan: c.brightCyan,
    brightWhite: c.brightWhite,
  }
}
