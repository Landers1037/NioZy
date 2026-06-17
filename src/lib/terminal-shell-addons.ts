import type { IDisposable, Terminal } from '@xterm/xterm'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import type { ShellSettings } from '../../electron/shared/shell-settings'
import type { PreviewSettings } from '../../electron/shared/preview-settings'
import { DEFAULT_PREVIEW_SETTINGS } from '../../electron/shared/preview-settings'
import { isAnyPreviewEnabled } from '@/lib/terminal-preview'
import {
  findUrlAtColumn,
  isValidHttpUrl,
  TERMINAL_LINK_FOREGROUND,
  TERMINAL_URL_REGEX,
} from '@/lib/terminal-url'
import { getLogHighlightSpans } from '@/lib/terminal-log-highlight'
import { handleTerminalLinkClick } from '@/lib/terminal-preview-open'
import { openTerminalExternalLink } from '@/lib/terminal-url'
import { isXtermForceSelectionMouseEvent } from '@/lib/xterm-mouse-selection'

/** WebGL 下 canvas 盖住 bottom 装饰，用屏幕坐标换算缓冲区列行再匹配 URL */
function getViewportCellFromMouse(term: Terminal, event: MouseEvent): { col: number; row: number } | null {
  const screen = term.element?.querySelector('.xterm-screen')
  if (!screen) return null
  const rect = screen.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const relX = event.clientX - rect.left
  const relY = event.clientY - rect.top
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null
  const col = Math.floor((relX / rect.width) * term.cols)
  const row = Math.floor((relY / rect.height) * term.rows)
  return {
    col: Math.min(term.cols - 1, Math.max(0, col)),
    row: Math.min(term.rows - 1, Math.max(0, row)),
  }
}

function bindHighlightLinkClickHandler(term: Terminal, listeners: IDisposable[]): void {
  const el = term.element
  if (!el) return

  const onMouseUp = (event: MouseEvent) => {
    if (
      isXtermForceSelectionMouseEvent(event, term.options.macOptionClickForcesSelection)
    ) {
      return
    }
    if (event.button !== 0 || term.hasSelection()) return
    const cell = getViewportCellFromMouse(term, event)
    if (!cell) return
    const bufferLine = term.buffer.active.viewportY + cell.row
    const line = term.buffer.active.getLine(bufferLine)
    if (!line) return
    const url = findUrlAtColumn(line.translateToString(false), cell.col)
    if (!url) return
    event.preventDefault()
    event.stopPropagation()
    openTerminalExternalLink(url)
  }

  const opts = { capture: true } as const
  el.addEventListener('mouseup', onMouseUp, opts)
  listeners.push({
    dispose: () => el.removeEventListener('mouseup', onMouseUp, opts),
  })
}

export interface TerminalShellAddonState {
  unicode11: Unicode11Addon | null
  webLinks: WebLinksAddon | null
  webLinksClick: boolean | null
  linkHighlightDisposables: IDisposable[]
  linkHighlightListeners: IDisposable[]
  linkHighlightFrame: number
  logHighlightDisposables: IDisposable[]
  logHighlightListeners: IDisposable[]
  logHighlightFrame: number
}

export function createTerminalShellAddonState(): TerminalShellAddonState {
  return {
    unicode11: null,
    webLinks: null,
    webLinksClick: null,
    linkHighlightDisposables: [],
    linkHighlightListeners: [],
    linkHighlightFrame: 0,
    logHighlightDisposables: [],
    logHighlightListeners: [],
    logHighlightFrame: 0,
  }
}

function ensureUnicodeProposedApi(term: Terminal): void {
  term.options.allowProposedApi = true
}

function markerForBufferLine(term: Terminal, bufferLine: number) {
  const buffer = term.buffer.active
  return term.registerMarker(bufferLine - (buffer.baseY + buffer.cursorY))
}

function disposeAll(items: IDisposable[]): void {
  for (const item of items) {
    item.dispose()
  }
  items.length = 0
}

let _linkHighlightLastViewportY = -1
let _linkHighlightLastBufferLen = -1
let _linkHighlightLastRows = -1

function refreshLinkHighlightDecorations(term: Terminal, state: TerminalShellAddonState): void {
  const buffer = term.buffer.active
  const viewportY = buffer.viewportY
  const bufferLen = buffer.length
  const rows = term.rows

  // Skip if viewport position and buffer length haven't changed
  if (
    viewportY === _linkHighlightLastViewportY &&
    bufferLen === _linkHighlightLastBufferLen &&
    rows === _linkHighlightLastRows &&
    state.linkHighlightDisposables.length > 0
  ) {
    return
  }
  _linkHighlightLastViewportY = viewportY
  _linkHighlightLastBufferLen = bufferLen
  _linkHighlightLastRows = rows

  disposeAll(state.linkHighlightDisposables)

  const scanStart = Math.max(0, viewportY - 20)
  const scanEnd = Math.min(bufferLen, viewportY + rows + 20)

  for (let y = scanStart; y < scanEnd; y++) {
    const line = buffer.getLine(y)
    if (!line) continue

    const text = line.translateToString(false)
    TERMINAL_URL_REGEX.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = TERMINAL_URL_REGEX.exec(text)) !== null) {
      const url = match[0]
      if (!isValidHttpUrl(url)) continue

      const marker = markerForBufferLine(term, y)
      if (!marker || marker.isDisposed) continue

      const decoration = term.registerDecoration({
        marker,
        x: match.index,
        width: url.length,
        foregroundColor: TERMINAL_LINK_FOREGROUND,
        layer: 'bottom',
      })

      if (!decoration) {
        marker.dispose()
        continue
      }

      state.linkHighlightDisposables.push({
        dispose: () => {
          decoration.dispose()
          marker.dispose()
        },
      })
    }
  }
}

/** 链接高亮刷新上限（约 10fps），减轻高频输出时的正则扫描开销 */
const LINK_HIGHLIGHT_MIN_INTERVAL_MS = 100

function bindLinkHighlightListeners(
  term: Terminal,
  state: TerminalShellAddonState,
  clickToOpenLinks: boolean,
): void {
  disposeAll(state.linkHighlightListeners)
  cancelAnimationFrame(state.linkHighlightFrame)
  state.linkHighlightFrame = 0

  if (clickToOpenLinks) {
    bindHighlightLinkClickHandler(term, state.linkHighlightListeners)
  }

  const throttled = createThrottledHighlightScheduler(LINK_HIGHLIGHT_MIN_INTERVAL_MS, () => {
    state.linkHighlightFrame = 0
    refreshLinkHighlightDecorations(term, state)
  }, term)

  state.linkHighlightListeners.push(
    term.onWriteParsed(() => throttled.schedule()),
    term.onScroll(() => throttled.schedule(true)),
    term.onResize(() => throttled.schedule(true)),
    { dispose: () => throttled.dispose() },
  )

  throttled.schedule(true)
}

function clearLinkHighlight(_term: Terminal, state: TerminalShellAddonState): void {
  cancelAnimationFrame(state.linkHighlightFrame)
  state.linkHighlightFrame = 0
  disposeAll(state.linkHighlightDisposables)
  disposeAll(state.linkHighlightListeners)
}

let _logHighlightLastViewportY = -1
let _logHighlightLastBufferLen = -1
let _logHighlightLastRows = -1

function refreshLogHighlightDecorations(term: Terminal, state: TerminalShellAddonState): void {
  const buffer = term.buffer.active
  const viewportY = buffer.viewportY
  const bufferLen = buffer.length
  const rows = term.rows

  // Skip if viewport position and buffer length haven't changed
  if (
    viewportY === _logHighlightLastViewportY &&
    bufferLen === _logHighlightLastBufferLen &&
    rows === _logHighlightLastRows &&
    state.logHighlightDisposables.length > 0
  ) {
    return
  }
  _logHighlightLastViewportY = viewportY
  _logHighlightLastBufferLen = bufferLen
  _logHighlightLastRows = rows

  disposeAll(state.logHighlightDisposables)

  const scanStart = Math.max(0, viewportY - 20)
  const scanEnd = Math.min(bufferLen, viewportY + rows + 20)

  for (let y = scanStart; y < scanEnd; y++) {
    const line = buffer.getLine(y)
    if (!line) continue

    const text = line.translateToString(false)
    const spans = getLogHighlightSpans(text)
    if (spans.length === 0) continue

    const marker = markerForBufferLine(term, y)
    if (!marker || marker.isDisposed) continue

    const decorations: IDisposable[] = []
    for (const span of spans) {
      const width = Math.max(1, span.end - span.start)
      const decoration = term.registerDecoration({
        marker,
        x: span.start,
        width,
        foregroundColor: span.color,
        layer: 'bottom',
      })
      if (decoration) decorations.push(decoration)
    }

    if (decorations.length === 0) {
      marker.dispose()
      continue
    }

    state.logHighlightDisposables.push({
      dispose: () => {
        for (const d of decorations) d.dispose()
        marker.dispose()
      },
    })
  }
}

/** 日志高亮刷新上限（约 10fps），减轻高频输出时的正则扫描开销 */
const LOG_HIGHLIGHT_MIN_INTERVAL_MS = 100

function isTerminalVisible(term: Terminal): boolean {
  const el = term.element
  if (!el) return false
  const host = el.closest('.niozy-terminal-host')
  if (!host) return true
  if (host.closest('[inert]')) return false
  return (host as HTMLElement).offsetParent !== null
}

function createThrottledHighlightScheduler(
  minIntervalMs: number,
  refresh: () => void,
  term: Terminal,
): { schedule: (immediate?: boolean) => void; dispose: () => void } {
  let lastRun = 0
  let raf = 0
  let trailingTimer: ReturnType<typeof setTimeout> | null = null
  let dirty = false

  const doRefresh = (): void => {
    raf = 0
    if (!isTerminalVisible(term)) return
    lastRun = Date.now()
    refresh()
  }

  const ensureRaf = (): void => {
    if (raf) return
    raf = requestAnimationFrame(doRefresh)
  }

  const schedule = (immediate = false): void => {
    dirty = true

    if (immediate) {
      if (trailingTimer) {
        clearTimeout(trailingTimer)
        trailingTimer = null
      }
      ensureRaf()
      return
    }

    const now = Date.now()
    if (now - lastRun >= minIntervalMs) {
      ensureRaf()
      return
    }

    if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null
        if (dirty) ensureRaf()
      }, minIntervalMs - (now - lastRun))
    }
  }

  return {
    schedule,
    dispose: () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      if (trailingTimer) { clearTimeout(trailingTimer); trailingTimer = null }
      dirty = false
    },
  }
}

function bindLogHighlightListeners(term: Terminal, state: TerminalShellAddonState): void {
  disposeAll(state.logHighlightListeners)
  cancelAnimationFrame(state.logHighlightFrame)
  state.logHighlightFrame = 0

  const throttled = createThrottledHighlightScheduler(LOG_HIGHLIGHT_MIN_INTERVAL_MS, () => {
    state.logHighlightFrame = 0
    refreshLogHighlightDecorations(term, state)
  }, term)

  state.logHighlightListeners.push(
    term.onWriteParsed(() => throttled.schedule()),
    term.onScroll(() => throttled.schedule(true)),
    term.onResize(() => throttled.schedule(true)),
    { dispose: () => throttled.dispose() },
  )

  throttled.schedule(true)
}

function clearLogHighlight(_term: Terminal, state: TerminalShellAddonState): void {
  cancelAnimationFrame(state.logHighlightFrame)
  state.logHighlightFrame = 0
  disposeAll(state.logHighlightDisposables)
  disposeAll(state.logHighlightListeners)
}

function syncWebLinksAddon(
  term: Terminal,
  state: TerminalShellAddonState,
  shell: ShellSettings,
  preview: PreviewSettings,
): void {
  const enable = shell.highlightLinks || shell.clickToOpenLinks
  /** 高亮 + 点击：由缓冲区坐标处理，避免 WebGL canvas 挡住装饰/WebLinks */
  const click = shell.clickToOpenLinks && !shell.highlightLinks

  if (!enable) {
    if (state.webLinks) {
      state.webLinks.dispose()
      state.webLinks = null
      state.webLinksClick = null
    }
    return
  }

  if (state.webLinks && state.webLinksClick === click) return

  if (state.webLinks) {
    state.webLinks.dispose()
    state.webLinks = null
  }

  const handler = click
    ? (event: MouseEvent, uri: string) => {
        if (!handleTerminalLinkClick(uri, event, preview, true)) {
          /* WebLinks 无匹配时保持默认 */
        }
      }
    : () => {}

  const addon = new WebLinksAddon(handler)
  state.webLinks = addon
  state.webLinksClick = click
  term.loadAddon(addon)
  term.refresh(0, term.rows - 1)
}

export function applyTerminalShellAddons(
  term: Terminal,
  state: TerminalShellAddonState,
  shell: ShellSettings,
  preview: PreviewSettings = DEFAULT_PREVIEW_SETTINGS,
): void {
  const externalPreviewClick =
    isAnyPreviewEnabled(preview) || shell.clickToOpenLinks
  if (shell.emojiNativeRendering) {
    if (!state.unicode11) {
      ensureUnicodeProposedApi(term)
      const addon = new Unicode11Addon()
      state.unicode11 = addon
      term.loadAddon(addon)
      term.unicode.activeVersion = '11'
    }
  } else if (state.unicode11) {
    ensureUnicodeProposedApi(term)
    term.unicode.activeVersion = '6'
    state.unicode11.dispose()
    state.unicode11 = null
  }

  syncWebLinksAddon(term, state, shell, preview)

  if (shell.highlightLinks) {
    bindLinkHighlightListeners(
      term,
      state,
      shell.clickToOpenLinks && !externalPreviewClick,
    )
  } else {
    clearLinkHighlight(term, state)
  }

  if (shell.highlightLogLevels) {
    bindLogHighlightListeners(term, state)
  } else {
    clearLogHighlight(term, state)
  }
}
