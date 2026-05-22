import type { IDisposable, Terminal } from '@xterm/xterm'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import type { ShellSettings } from '../../electron/shared/shell-settings'
import { getElectronAPI } from '@/lib/electron-client'

/** 与 @xterm/addon-web-links 内置规则一致 */
const URL_REGEX =
  /(https?):[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/gi

const LINK_FOREGROUND = '#58a6ff'

export interface TerminalShellAddonState {
  unicode11: Unicode11Addon | null
  webLinks: WebLinksAddon | null
  webLinksClick: boolean | null
  linkHighlightDisposables: IDisposable[]
  linkHighlightListeners: IDisposable[]
  linkHighlightFrame: number
}

export function createTerminalShellAddonState(): TerminalShellAddonState {
  return {
    unicode11: null,
    webLinks: null,
    webLinksClick: null,
    linkHighlightDisposables: [],
    linkHighlightListeners: [],
    linkHighlightFrame: 0,
  }
}

function ensureUnicodeProposedApi(term: Terminal): void {
  term.options.allowProposedApi = true
}

function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
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

function refreshLinkHighlightDecorations(term: Terminal, state: TerminalShellAddonState): void {
  disposeAll(state.linkHighlightDisposables)

  const buffer = term.buffer.active
  const scanStart = Math.max(0, buffer.viewportY - 20)
  const scanEnd = Math.min(buffer.length, buffer.viewportY + term.rows + 20)

  for (let y = scanStart; y < scanEnd; y++) {
    const line = buffer.getLine(y)
    if (!line) continue

    const text = line.translateToString(false)
    URL_REGEX.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = URL_REGEX.exec(text)) !== null) {
      const url = match[0]
      if (!isValidHttpUrl(url)) continue

      const marker = markerForBufferLine(term, y)
      if (!marker || marker.isDisposed) continue

      const decoration = term.registerDecoration({
        marker,
        x: match.index,
        width: url.length,
        foregroundColor: LINK_FOREGROUND,
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

function bindLinkHighlightListeners(term: Terminal, state: TerminalShellAddonState): void {
  disposeAll(state.linkHighlightListeners)
  cancelAnimationFrame(state.linkHighlightFrame)
  state.linkHighlightFrame = 0

  const scheduleRefresh = () => {
    cancelAnimationFrame(state.linkHighlightFrame)
    state.linkHighlightFrame = requestAnimationFrame(() => {
      refreshLinkHighlightDecorations(term, state)
    })
  }

  state.linkHighlightListeners.push(
    term.onWriteParsed(scheduleRefresh),
    term.onScroll(scheduleRefresh),
    term.onRender(scheduleRefresh),
    term.onResize(scheduleRefresh),
  )

  scheduleRefresh()
}

function clearLinkHighlight(_term: Terminal, state: TerminalShellAddonState): void {
  cancelAnimationFrame(state.linkHighlightFrame)
  state.linkHighlightFrame = 0
  disposeAll(state.linkHighlightDisposables)
  disposeAll(state.linkHighlightListeners)
}

function syncWebLinksAddon(
  term: Terminal,
  state: TerminalShellAddonState,
  shell: ShellSettings,
): void {
  const enable = shell.highlightLinks || shell.clickToOpenLinks
  const click = shell.clickToOpenLinks

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
    ? (_event: MouseEvent, uri: string) => {
        void getElectronAPI().shell.openExternal(uri)
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
): void {
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

  syncWebLinksAddon(term, state, shell)

  if (shell.highlightLinks) {
    bindLinkHighlightListeners(term, state)
  } else {
    clearLinkHighlight(term, state)
  }
}
