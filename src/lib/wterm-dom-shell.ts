import type { WTerm } from '@wterm/dom'
import type { ShellSettings } from '../../electron/shared/shell-settings'
import type { PreviewSettings } from '../../electron/shared/preview-settings'
import { DEFAULT_PREVIEW_SETTINGS } from '../../electron/shared/preview-settings'
import {
  escapeHtml,
  lineTextHasUrl,
  TERMINAL_LINK_FOREGROUND,
  TERMINAL_URL_REGEX,
} from '@/lib/terminal-url'
import {
  attachAlternateScreenShiftDomSelect,
} from '@/lib/terminal-interactive-cli'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import { handleTerminalRightClickCopyPaste } from '@/lib/terminal-right-click'
import {
  isTerminalAdvancedRightClickMenuEnabled,
  isTerminalRightClickCopyPasteEnabled,
  openTerminalAdvancedContextMenu,
} from '@/lib/terminal-advanced-context-menu'
import { isWtermNearBottom, queueWtermScrollToBottom } from '@/lib/wterm-scroll'
import { isAnyPreviewEnabled } from '@/lib/terminal-preview'
import { bindDomTerminalPreview } from '@/lib/terminal-preview-mouse'

const WTERM_LINK_CLASS = 'niozy-wterm-link'
const PROCESSED_ATTR = 'data-niozy-links'

export interface WtermDomShellOptions {
  terminalId: string
  tabId: string
  rightClickCopyPaste: boolean
  advancedRightClickMenu: boolean
  shell: ShellSettings
  preview?: PreviewSettings
  isSsh?: boolean
  getCwd?: () => string | undefined
}

function getColFromMouseEvent(rowEl: HTMLElement, event: MouseEvent): number | null {
  const doc = rowEl.ownerDocument
  const caretFromPoint =
    doc.caretRangeFromPoint?.bind(doc) ??
    (
      doc as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null
      }
    ).caretPositionFromPoint?.bind(doc)

  if (!caretFromPoint) return null

  const pos = caretFromPoint(event.clientX, event.clientY)
  if (!pos) return null

  if ('startContainer' in pos) {
    const range = pos as Range
    if (!rowEl.contains(range.startContainer)) return null
    const pre = doc.createRange()
    pre.selectNodeContents(rowEl)
    pre.setEnd(range.startContainer, range.startOffset)
    return pre.toString().length
  }

  const offset = (pos as { offset: number }).offset
  const text = rowEl.textContent ?? ''
  return Math.min(text.length, Math.max(0, offset))
}

function buildHighlightedRowHtml(lineText: string): string | null {
  TERMINAL_URL_REGEX.lastIndex = 0
  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let found = false

  while ((match = TERMINAL_URL_REGEX.exec(lineText)) !== null) {
    const url = match[0]
    const start = match.index
    if (!url || start < lastIndex) continue
    parts.push(escapeHtml(lineText.slice(lastIndex, start)))
    parts.push(
      `<span class="${WTERM_LINK_CLASS}" style="color:${TERMINAL_LINK_FOREGROUND};text-decoration:underline;text-underline-offset:2px;cursor:pointer">${escapeHtml(url)}</span>`,
    )
    lastIndex = start + url.length
    found = true
  }

  if (!found) return null
  parts.push(escapeHtml(lineText.slice(lastIndex)))
  return parts.join('')
}

function refreshLinkHighlights(
  root: HTMLElement,
  highlightLinks: boolean,
  followScroll: boolean,
): void {
  if (!highlightLinks) {
    for (const row of root.querySelectorAll('.term-row')) {
      row.removeAttribute(PROCESSED_ATTR)
    }
    return
  }

  const rows = root.querySelectorAll('.term-grid .term-row, .term-row')
  for (const row of rows) {
    const rowEl = row as HTMLElement
    if (rowEl.querySelector('.term-cursor')) continue
    const text = rowEl.textContent ?? ''
    if (!lineTextHasUrl(text)) {
      rowEl.removeAttribute(PROCESSED_ATTR)
      continue
    }
    const html = buildHighlightedRowHtml(text)
    if (!html) {
      rowEl.removeAttribute(PROCESSED_ATTR)
      continue
    }
    rowEl.innerHTML = html
    rowEl.setAttribute(PROCESSED_ATTR, '1')
  }

  if (followScroll && isWtermNearBottom(root)) {
    queueWtermScrollToBottom(root)
  }
}

function bindRightClickBehavior(
  root: HTMLElement,
  options: Pick<WtermDomShellOptions, 'terminalId' | 'tabId' | 'rightClickCopyPaste' | 'advancedRightClickMenu'>,
  listeners: Array<() => void>,
): void {
  const terminalSettings = {
    rightClickCopyPaste: options.rightClickCopyPaste,
    advancedRightClickMenu: options.advancedRightClickMenu,
  }
  const copyPasteEnabled = isTerminalRightClickCopyPasteEnabled(terminalSettings)
  const advancedMenuEnabled = isTerminalAdvancedRightClickMenuEnabled(terminalSettings)
  if (!copyPasteEnabled && !advancedMenuEnabled) return

  const captureOpts = { capture: true } as const

  const onRightMouseUp = (e: MouseEvent) => {
    if (e.button !== 2 || !copyPasteEnabled) return
    handleTerminalRightClickCopyPaste(
      options.terminalId,
      () => readTerminalSelectionText(),
      e,
    )
  }

  const onContextMenu = (e: MouseEvent) => {
    if (copyPasteEnabled) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!advancedMenuEnabled) return
    openTerminalAdvancedContextMenu(e, options.terminalId, options.tabId)
  }

  root.addEventListener('mouseup', onRightMouseUp, captureOpts)
  root.addEventListener('contextmenu', onContextMenu, captureOpts)
  listeners.push(() => {
    root.removeEventListener('mouseup', onRightMouseUp, captureOpts)
    root.removeEventListener('contextmenu', onContextMenu, captureOpts)
  })
}

function bindInteractiveCliMouse(
  instance: WTerm,
  shiftEnterNewline: boolean,
  listeners: Array<() => void>,
): void {
  const onMouseDown = (event: MouseEvent) => {
    if (event.type !== 'mousedown' || event.button !== 0) return
    if (!instance.bridge?.usingAltScreen()) return
    if (event.altKey) return

    if (event.shiftKey) {
      attachAlternateScreenShiftDomSelect(instance.element, event, () => {
        queueMicrotask(() => {
          const text = readTerminalSelectionText()
          if (text) void navigator.clipboard.writeText(text)
        })
      })
      return
    }

    if (!shiftEnterNewline) return

    event.preventDefault()
    event.stopImmediatePropagation()
    instance.focus()
  }

  instance.element.addEventListener('mousedown', onMouseDown, true)
  listeners.push(() => instance.element.removeEventListener('mousedown', onMouseDown, true))
}

/** 为 Wterm DOM 终端挂载与 xterm 设置对齐的链接、右键与交互式 CLI 行为 */
export function attachWtermDomShellFeatures(
  instance: WTerm,
  options: WtermDomShellOptions,
): () => void {
  const root = instance.element
  const listeners: Array<() => void> = []
  let highlightFrame = 0
  let observer: MutationObserver | null = null

  bindRightClickBehavior(root, options, listeners)
  const { highlightLinks, clickToOpenLinks, shiftEnterNewline } = options.shell
  const preview = options.preview ?? DEFAULT_PREVIEW_SETTINGS
  if (clickToOpenLinks || isAnyPreviewEnabled(preview)) {
    bindDomTerminalPreview(
      root,
      {
        preview,
        shell: options.shell,
        isSsh: options.isSsh === true,
        getCwd: options.getCwd ?? (() => undefined),
      },
      getColFromMouseEvent,
      listeners,
    )
  }
  bindInteractiveCliMouse(instance, shiftEnterNewline, listeners)

  const scheduleHighlight = () => {
    if (!highlightLinks) return
    cancelAnimationFrame(highlightFrame)
    highlightFrame = requestAnimationFrame(() => {
      const followScroll = isWtermNearBottom(root)
      refreshLinkHighlights(root, true, followScroll)
    })
  }

  if (highlightLinks) {
    const grid = root.querySelector('.term-grid') ?? root
    observer = new MutationObserver(scheduleHighlight)
    observer.observe(grid, { childList: true, subtree: true })
    scheduleHighlight()
    listeners.push(() => {
      observer?.disconnect()
      observer = null
      cancelAnimationFrame(highlightFrame)
    })
  }

  return () => {
    for (const off of listeners) off()
    refreshLinkHighlights(root, false, false)
  }
}
