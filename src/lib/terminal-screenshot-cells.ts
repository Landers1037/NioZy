import type { IBufferCell, Terminal } from '@xterm/xterm'
import type { TerminalColorScheme } from '../../electron/shared/terminal-color-schemes'
import { resolveTerminalTheme, getThemePalette } from '@/lib/terminal-themes'

export interface ScreenshotRgb {
  r: number
  g: number
  b: number
}

export interface ScreenshotCell {
  chars: string
  fg: ScreenshotRgb
  bg: ScreenshotRgb | null
}

export interface ScreenshotViewportPayload {
  cssW: number
  cssH: number
  dpr: number
  cols: number
  rows: number
  fontSize: number
  fontFamily: string
  lineHeight: number
  bgDefault: ScreenshotRgb
  cells: ScreenshotCell[][]
}

function parseHexColor(hex: string): ScreenshotRgb {
  const normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0]! + normalized[0]!, 16)
    const g = Number.parseInt(normalized[1]! + normalized[1]!, 16)
    const b = Number.parseInt(normalized[2]! + normalized[2]!, 16)
    return { r, g, b }
  }
  if (normalized.length >= 6) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    }
  }
  return { r: 0, g: 0, b: 0 }
}

function hexToRgb(hex: string): ScreenshotRgb {
  return parseHexColor(hex.startsWith('#') ? hex : `#${hex}`)
}

function xterm256Component(level: number): number {
  if (level <= 0) return 0
  return 55 + (level - 1) * 40
}

function xterm256Color(index: number): ScreenshotRgb {
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10
    return { r: gray, g: gray, b: gray }
  }
  const cube = index - 16
  const r = Math.floor(cube / 36)
  const g = Math.floor((cube % 36) / 6)
  const b = cube % 6
  return {
    r: xterm256Component(r),
    g: xterm256Component(g),
    b: xterm256Component(b),
  }
}

function paletteColor(theme: ReturnType<typeof resolveTerminalTheme>, index: number): ScreenshotRgb {
  const palette = getThemePalette(theme)
  if (index >= 0 && index < 16) {
    return hexToRgb(palette[index]!)
  }
  if (index >= 16 && index < 256) {
    return xterm256Color(index)
  }
  return hexToRgb(theme.foreground ?? '#d4d4d4')
}

function resolveCellFgRgb(cell: IBufferCell, scheme: TerminalColorScheme): ScreenshotRgb {
  const theme = resolveTerminalTheme(scheme)
  const fgDefault = hexToRgb(theme.foreground ?? '#d4d4d4')

  if (cell.isFgRGB()) {
    const c = cell.getFgColor()
    return { r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff }
  }
  if (cell.isFgPalette()) {
    return paletteColor(theme, cell.getFgColor())
  }
  return fgDefault
}

function resolveCellBgRgb(cell: IBufferCell, scheme: TerminalColorScheme): ScreenshotRgb | null {
  const theme = resolveTerminalTheme(scheme)
  const bgDefault = hexToRgb(theme.background ?? '#101419')

  if (cell.isBgRGB()) {
    const c = cell.getBgColor()
    return { r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff }
  }
  if (cell.isBgPalette()) {
    return paletteColor(theme, cell.getBgColor())
  }
  if (cell.isBgDefault()) return null
  return bgDefault
}

export function serializeXtermViewport(
  term: Terminal,
  scheme: TerminalColorScheme,
): ScreenshotViewportPayload | null {
  const screen = term.element?.querySelector('.xterm-screen') as HTMLElement | null
  if (!screen) return null

  const cssW = Math.max(1, Math.round(screen.clientWidth))
  const cssH = Math.max(1, Math.round(screen.clientHeight))
  const dpr = window.devicePixelRatio || 1
  const theme = resolveTerminalTheme(scheme)
  const bgDefault = hexToRgb(theme.background ?? '#101419')
  const fontSize = term.options.fontSize ?? 13
  const fontFamily = term.options.fontFamily ?? 'monospace'
  const lineHeight = term.options.lineHeight ?? 1

  const buf = term.buffer.active
  const visibleRows = term.rows
  const startRow = buf.viewportY
  const { cols } = term
  const cells: ScreenshotCell[][] = []

  for (let viewRow = 0; viewRow < visibleRows; viewRow++) {
    const bufferRow = startRow + viewRow
    const line = buf.getLine(bufferRow)
    const rowCells: ScreenshotCell[] = []
    if (!line) {
      for (let col = 0; col < cols; col++) {
        rowCells.push({ chars: ' ', fg: hexToRgb(theme.foreground ?? '#d4d4d4'), bg: null })
      }
      cells.push(rowCells)
      continue
    }

    const themeBg = hexToRgb(theme.background ?? '#101419')
    for (let col = 0; col < cols; col++) {
      const cell = line.getCell(col)
      if (!cell) {
        rowCells.push({ chars: ' ', fg: hexToRgb(theme.foreground ?? '#d4d4d4'), bg: null })
        continue
      }

      let fgRgb = resolveCellFgRgb(cell, scheme)
      let bgRgb = resolveCellBgRgb(cell, scheme)
      if (cell.isInverse()) {
        const nextFg = bgRgb ?? themeBg
        const nextBg = fgRgb
        fgRgb = nextFg
        bgRgb = nextBg
      }

      const chars = cell.getChars()
      rowCells.push({
        chars: chars || ' ',
        fg: fgRgb,
        bg: bgRgb,
      })
    }
    cells.push(rowCells)
  }

  return {
    cssW,
    cssH,
    dpr,
    cols,
    rows: visibleRows,
    fontSize,
    fontFamily,
    lineHeight,
    bgDefault,
    cells,
  }
}

function rgbToCss(rgb: ScreenshotRgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

export function renderScreenshotPayloadToCanvas(payload: ScreenshotViewportPayload): HTMLCanvasElement {
  const { cssW, cssH, dpr, cols, rows, fontSize, fontFamily, lineHeight, bgDefault, cells } = payload
  const target = document.createElement('canvas')
  target.width = Math.round(cssW * dpr)
  target.height = Math.round(cssH * dpr)
  const ctx = target.getContext('2d')
  if (!ctx) return target
  ctx.scale(dpr, dpr)
  ctx.fillStyle = rgbToCss(bgDefault)
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'
  const cellW = cssW / Math.max(cols, 1)
  const cellH = cssH / Math.max(rows, 1)
  const lineHeightPx = fontSize * lineHeight

  for (let viewRow = 0; viewRow < rows; viewRow++) {
    const rowCells = cells[viewRow] ?? []
    for (let col = 0; col < cols; col++) {
      const cell = rowCells[col]
      if (!cell) continue
      if (cell.bg) {
        ctx.fillStyle = rgbToCss(cell.bg)
        ctx.fillRect(col * cellW, viewRow * cellH, cellW, cellH)
      }
      if (!cell.chars || cell.chars === ' ') continue
      ctx.fillStyle = rgbToCss(cell.fg)
      ctx.fillText(cell.chars, col * cellW, viewRow * cellH + (cellH - lineHeightPx) / 2)
    }
  }
  return target
}
