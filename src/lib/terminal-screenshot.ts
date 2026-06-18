import type { Terminal } from '@xterm/xterm'
import type { TerminalColorScheme } from '../../electron/shared/terminal-color-schemes'
import { TERMINAL_COLOR_SCHEME_IDS } from '../../electron/shared/terminal-color-schemes'
import { getTerminal } from '@/lib/terminal-registry'
import { getTerminalHost } from '@/lib/terminal-host-registry'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { useAppStore } from '@/stores/app-store'
import { isWtermEmulator } from '@/lib/terminal-emulator'
import { resolveTerminalTheme } from '@/lib/terminal-themes'
import { findXtermRenderCanvas } from '@/lib/terminal-idle-animation/black-hole-renderer'
import { ensureWtermTerminalThemes } from '@/lib/wterm-theme'
import {
  renderScreenshotPayloadToCanvas,
  serializeXtermViewport,
} from '@/lib/terminal-screenshot-cells'
import {
  renderScreenshotInWorker,
  screenshotBitmapToCanvas,
} from '@/lib/terminal-screenshot-worker-client'
import { getElectronAPI } from '@/lib/electron-client'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

export type TerminalScreenshotFormat = 'png' | 'jpg' | 'svg'
export type TerminalScreenshotWatermark = 'none' | 'default' | 'custom'

export interface TerminalScreenshotOptions {
  format: TerminalScreenshotFormat
  colorScheme: TerminalColorScheme
  watermark: TerminalScreenshotWatermark
  customWatermarkText?: string
}

const DEFAULT_WATERMARK = 'by NioZy'
const SCREENSHOT_EDGE_PADDING_PX = 10

function isCanvasMostlyBlank(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const sample = ctx.getImageData(
    Math.min(2, width - 1),
    Math.min(2, height - 1),
    1,
    1,
  ).data
  return sample[3]! === 0 || sample[0]! + sample[1]! + sample[2]! === 0
}

function getXtermVisibleScreen(term: Terminal): HTMLElement | null {
  return term.element?.querySelector('.xterm-screen') as HTMLElement | null
}

/** 从 WebGL/Canvas 渲染层截取当前可见 viewport（不含 scrollback） */
function captureXtermRenderCanvas(term: Terminal): HTMLCanvasElement | null {
  const screen = getXtermVisibleScreen(term)
  const renderCanvas = findXtermRenderCanvas(term)
  if (!screen || !renderCanvas || renderCanvas.width <= 0 || renderCanvas.height <= 0) {
    return null
  }

  const cssW = Math.max(1, Math.round(screen.clientWidth))
  const cssH = Math.max(1, Math.round(screen.clientHeight))
  const dpr = window.devicePixelRatio || 1

  const target = document.createElement('canvas')
  target.width = Math.round(cssW * dpr)
  target.height = Math.round(cssH * dpr)
  const ctx = target.getContext('2d')
  if (!ctx) return null

  const srcW = Math.min(renderCanvas.width, Math.round(cssW * dpr))
  const srcH = Math.min(renderCanvas.height, Math.round(cssH * dpr))
  ctx.drawImage(renderCanvas, 0, 0, srcW, srcH, 0, 0, target.width, target.height)

  if (isCanvasMostlyBlank(ctx, target.width, target.height)) {
    return null
  }
  return target
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function getWtermCaptureStyles(): string {
  ensureWtermTerminalThemes()
  const themeStyles = document.getElementById('niozy-wterm-terminal-themes')?.textContent ?? ''
  const inlineRules: string[] = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText
        if (text.includes('.wterm') || text.includes('.term-grid') || text.includes('.term-row')) {
          inlineRules.push(text)
        }
      }
    } catch {
      // 跨域样式表不可读，忽略
    }
  }
  return `${themeStyles}\n${inlineRules.join('\n')}`
}

async function captureDomViewport(element: HTMLElement, extraStyles = ''): Promise<HTMLCanvasElement | null> {
  const cssW = Math.max(1, Math.round(element.clientWidth))
  const cssH = Math.max(1, Math.round(element.clientHeight))
  if (cssW <= 0 || cssH <= 0) return null

  const dpr = window.devicePixelRatio || 1
  const target = document.createElement('canvas')
  target.width = Math.round(cssW * dpr)
  target.height = Math.round(cssH * dpr)
  const ctx = target.getContext('2d')
  if (!ctx) return null

  const renderCanvas = element.querySelector('canvas') as HTMLCanvasElement | null
  if (renderCanvas && renderCanvas.width > 0 && renderCanvas.height > 0) {
    const srcW = Math.min(renderCanvas.width, Math.round(cssW * dpr))
    const srcH = Math.min(renderCanvas.height, Math.round(cssH * dpr))
    ctx.drawImage(renderCanvas, 0, 0, srcW, srcH, 0, 0, target.width, target.height)
    if (!isCanvasMostlyBlank(ctx, target.width, target.height)) {
      return target
    }
  }

  const clone = element.cloneNode(true) as HTMLElement
  clone.style.overflow = 'hidden'
  clone.style.width = `${cssW}px`
  clone.style.height = `${cssH}px`
  clone.style.margin = '0'
  clone.style.padding = '0'

  const serialized = new XMLSerializer().serializeToString(clone)
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}">
<style>${extraStyles}</style>
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:${cssW}px;height:${cssH}px;overflow:hidden;margin:0;padding:0;">
${serialized}
</div>
</foreignObject>
</svg>`

  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    ctx.drawImage(img, 0, 0, target.width, target.height)
    return target
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function captureWtermVisible(
  wterm: HTMLElement,
  scheme: TerminalColorScheme,
  currentScheme: TerminalColorScheme,
): Promise<HTMLCanvasElement | null> {
  const cssW = Math.max(1, Math.round(wterm.clientWidth))
  const cssH = Math.max(1, Math.round(wterm.clientHeight))

  const sandbox = document.createElement('div')
  sandbox.style.cssText = 'position:fixed;left:-10000px;top:0;overflow:hidden;pointer-events:none;'
  sandbox.style.width = `${cssW}px`
  sandbox.style.height = `${cssH}px`

  const clone = wterm.cloneNode(true) as HTMLElement
  if (scheme !== currentScheme) {
    for (const id of TERMINAL_COLOR_SCHEME_IDS) {
      clone.classList.remove(`theme-${id}`)
    }
    clone.classList.add(`theme-${scheme}`)
  }
  clone.style.width = `${cssW}px`
  clone.style.height = `${cssH}px`
  clone.style.overflow = 'hidden'

  const grid = wterm.querySelector('.term-grid') as HTMLElement | null
  const gridClone = clone.querySelector('.term-grid') as HTMLElement | null
  if (grid && gridClone) {
    gridClone.scrollTop = grid.scrollTop
  }

  sandbox.appendChild(clone)
  document.body.appendChild(sandbox)
  try {
    return await captureDomViewport(clone, getWtermCaptureStyles())
  } finally {
    document.body.removeChild(sandbox)
  }
}

async function captureXtermToCanvas(
  term: Terminal,
  scheme: TerminalColorScheme,
  currentScheme: TerminalColorScheme,
): Promise<HTMLCanvasElement | null> {
  if (scheme === currentScheme) {
    const pixels = captureXtermRenderCanvas(term)
    if (pixels) return pixels
  }

  const payload = serializeXtermViewport(term, scheme)
  if (!payload) return null

  if (scheme !== currentScheme) {
    try {
      const bitmap = await renderScreenshotInWorker(payload)
      return screenshotBitmapToCanvas(bitmap)
    } catch {
      return renderScreenshotPayloadToCanvas(payload)
    }
  }

  return renderScreenshotPayloadToCanvas(payload)
}

function applyScreenshotEdgePadding(
  canvas: HTMLCanvasElement,
  scheme: TerminalColorScheme,
): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1
  const pad = Math.round(SCREENSHOT_EDGE_PADDING_PX * dpr)
  const theme = resolveTerminalTheme(scheme)
  const bg = theme.background ?? '#101419'

  const padded = document.createElement('canvas')
  padded.width = canvas.width + pad * 2
  padded.height = canvas.height + pad * 2
  const ctx = padded.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = bg.startsWith('#') ? bg : `#${bg}`
  ctx.fillRect(0, 0, padded.width, padded.height)
  ctx.drawImage(canvas, pad, pad)
  return padded
}

function applyWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  scheme: TerminalColorScheme,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || !text) return
  const theme = resolveTerminalTheme(scheme)
  const fg = theme.foreground ?? '#cccccc'
  const padding = Math.max(12, Math.round(canvas.height * 0.02))
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = fg
  ctx.font = `${Math.max(12, Math.round(canvas.height * 0.025))}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(text, canvas.width - padding, canvas.height - padding)
  ctx.restore()
}

function canvasToSvg(canvas: HTMLCanvasElement): string {
  const pngData = canvas.toDataURL('image/png')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  <image href="${pngData}" width="${canvas.width}" height="${canvas.height}"/>
</svg>
`
}

export function formatScreenshotFileName(format: TerminalScreenshotFormat): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-')
  const ext = format === 'jpg' ? 'jpg' : format
  return `NioZy-screenshot-${stamp}.${ext}`
}

export async function exportTerminalScreenshot(
  tabId: string,
  options: TerminalScreenshotOptions,
): Promise<boolean> {
  const { tabs, settings } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || tab.type !== 'terminal') {
    toast.error(i18n.t('toast.exportNoTerminal'))
    return false
  }

  const terminalId = getActiveTerminalId(tab)
  if (!terminalId) {
    toast.error(i18n.t('toast.exportNoTerminal'))
    return false
  }

  const currentScheme = settings?.terminal.colorScheme ?? 'atom'
  const host = getTerminalHost(terminalId)
  const term = getTerminal(terminalId)
  const useWterm = isWtermEmulator(settings)

  let canvas: HTMLCanvasElement | null = null
  if (useWterm) {
    if (!host) {
      toast.error(i18n.t('toast.exportNotReady'))
      return false
    }
    const wterm = host.querySelector('.wterm') as HTMLElement | null
    if (!wterm) {
      toast.error(i18n.t('toast.exportNotReady'))
      return false
    }
    canvas = await captureWtermVisible(wterm, options.colorScheme, currentScheme)
  } else if (term) {
    canvas = await captureXtermToCanvas(term, options.colorScheme, currentScheme)
  } else {
    toast.error(i18n.t('toast.exportNotReady'))
    return false
  }

  if (!canvas) {
    toast.error(i18n.t('toast.screenshotCaptureFailed'))
    return false
  }

  canvas = applyScreenshotEdgePadding(canvas, options.colorScheme)

  const watermarkText =
    options.watermark === 'default'
      ? DEFAULT_WATERMARK
      : options.watermark === 'custom'
        ? (options.customWatermarkText?.trim() ?? '')
        : ''
  if (watermarkText) {
    applyWatermark(canvas, watermarkText, options.colorScheme)
  }

  const fileName = formatScreenshotFileName(options.format)
  const api = getElectronAPI()

  if (options.format === 'svg') {
    const saved = await api.files.saveImage({
      content: canvasToSvg(canvas),
      encoding: 'utf8',
      defaultFileName: fileName,
    })
    if (saved) toast.success(i18n.t('toast.screenshotExportSuccess'))
    return saved
  }

  const mimeType = options.format === 'jpg' ? 'image/jpeg' : 'image/png'
  const dataUrl = canvas.toDataURL(mimeType, options.format === 'jpg' ? 0.92 : undefined)
  const base64 = dataUrl.split(',')[1] ?? ''
  const saved = await api.files.saveImage({
    content: base64,
    encoding: 'base64',
    defaultFileName: fileName,
    mimeType,
  })
  if (saved) toast.success(i18n.t('toast.screenshotExportSuccess'))
  return saved
}
