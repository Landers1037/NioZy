import type { CSSProperties } from 'react'
import type { ITheme } from '@xterm/xterm'
import { getThemePalette } from '@/lib/terminal-themes'

/** 将 xterm 配色映射为 wterm DOM 渲染器的 CSS 变量 */
export function buildWtermThemeStyle(
  theme: ITheme,
  fontFamily: string,
  fontSize: number,
): CSSProperties {
  const palette = getThemePalette(theme)
  const bg = theme.background ?? '#1e1e1e'
  const fg = theme.foreground ?? '#d4d4d4'
  const cursor = (theme.cursor as string | undefined) ?? fg

  const vars: Record<string, string> = {
    '--term-bg': bg,
    '--term-fg': fg,
    '--term-cursor': cursor,
    '--term-font-family': fontFamily,
    '--term-font-size': `${fontSize}px`,
  }

  palette.forEach((color, index) => {
    vars[`--term-color-${index}`] = color
  })

  return vars as CSSProperties
}
