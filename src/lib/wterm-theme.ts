import type { CSSProperties } from 'react'
import type { ITheme } from '@xterm/xterm'
import {
  TERMINAL_COLOR_SCHEME_IDS,
  normalizeTerminalColorScheme,
  type TerminalColorScheme,
} from '../../electron/shared/terminal-color-schemes'
import { TERMINAL_THEMES, getThemePalette } from '@/lib/terminal-themes'

/** 设置中的配色方案 ID，对应 wterm `theme` 与 `.wterm.theme-{id}` */
export function getWtermThemeId(schemeId: string): TerminalColorScheme {
  return normalizeTerminalColorScheme(schemeId)
}

/** 将 xterm 配色映射为 wterm CSS 变量声明（用于 `.wterm.theme-*`） */
export function buildWtermThemeCssVariables(theme: ITheme): string {
  const palette = getThemePalette(theme)
  const bg = theme.background ?? '#1e1e1e'
  const fg = theme.foreground ?? '#d4d4d4'
  const cursor = (theme.cursor as string | undefined) ?? fg

  const vars: string[] = [
    `--term-bg: ${bg}`,
    `--term-fg: ${fg}`,
    `--term-cursor: ${cursor}`,
  ]

  palette.forEach((color, index) => {
    vars.push(`--term-color-${index}: ${color}`)
  })

  return vars.join('; ')
}

/** 字体相关变量，通过 Terminal `style` 作用于 `.wterm` 根节点 */
export function buildWtermFontStyle(
  fontFamily: string,
  fontSize: number,
  fontWeight?: number,
  fontWeightBold?: number,
): CSSProperties {
  return {
    '--term-font-family': fontFamily,
    '--term-font-size': `${fontSize}px`,
    ...(typeof fontWeight === 'number' ? { '--term-font-weight': `${fontWeight}` } : {}),
    ...(typeof fontWeightBold === 'number' ? { '--term-font-weight-bold': `${fontWeightBold}` } : {}),
  } as CSSProperties
}

let themesInjected = false

/** 将终端设置中的全部配色注册为 wterm 自定义主题类 */
export function ensureWtermTerminalThemes(): void {
  if (themesInjected || typeof document === 'undefined') return
  themesInjected = true

  const rules = TERMINAL_COLOR_SCHEME_IDS.map((id) => {
    const vars = buildWtermThemeCssVariables(TERMINAL_THEMES[id])
    return `.wterm.theme-${id}{${vars}}`
  }).join('\n')

  const el = document.createElement('style')
  el.id = 'niozy-wterm-terminal-themes'
  el.textContent = rules
  document.head.appendChild(el)
}
