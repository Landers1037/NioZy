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
import { getLogHighlightSpans, type LogHighlightSpan } from '@/lib/terminal-log-highlight'
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

type TextRange = { start: number; end: number }

function overlaps(a: TextRange, b: TextRange): boolean {
  return a.start < b.end && b.start < a.end
}

function getUrlRanges(lineText: string): TextRange[] {
  TERMINAL_URL_REGEX.lastIndex = 0
  const ranges: TextRange[] = []
  let match: RegExpExecArray | null
  while ((match = TERMINAL_URL_REGEX.exec(lineText)) !== null) {
    const url = match[0]
    const start = match.index
    if (!url || start < 0) continue
    ranges.push({ start, end: start + url.length })
  }
  return ranges
}

function buildEnhancedRowHtml(
  lineText: string,
  highlightLinks: boolean,
  logSpans: LogHighlightSpan[],
): string | null {
  const urlRanges = highlightLinks ? getUrlRanges(lineText) : []

  // 丢弃与 URL 重叠的日志高亮（避免把链接 span 打碎）
  const spans = logSpans.filter((s) => !urlRanges.some((u) => overlaps(u, s)))

  if (urlRanges.length === 0 && spans.length === 0) return null

  type Segment =
    | { kind: 'url'; start: number; end: number; text: string }
    | { kind: 'log'; start: number; end: number; text: string; color: string }

  const segments: Segment[] = []

  for (const u of urlRanges) {
    segments.push({
      kind: 'url',
      start: u.start,
      end: u.end,
      text: lineText.slice(u.start, u.end),
    })
  }

  for (const s of spans) {
    segments.push({
      kind: 'log',
      start: s.start,
      end: s.end,
      text: lineText.slice(s.start, s.end),
      color: s.color,
    })
  }

  segments.sort((a, b) => a.start - b.start || b.end - a.end)

  const picked: Segment[] = []
  let cursor = 0
  for (const seg of segments) {
    if (seg.start < cursor) continue
    picked.push(seg)
    cursor = seg.end
  }

  const parts: string[] = []
  let lastIndex = 0
  for (const seg of picked) {
    if (seg.start > lastIndex) parts.push(escapeHtml(lineText.slice(lastIndex, seg.start)))
    if (seg.kind === 'url') {
      parts.push(
        `<span class="${WTERM_LINK_CLASS}" style="color:${TERMINAL_LINK_FOREGROUND};text-decoration:underline;text-underline-offset:2px;cursor:pointer">${escapeHtml(seg.text)}</span>`,
      )
    } else {
      parts.push(
        `<span style="color:${escapeHtml(seg.color)}">${escapeHtml(seg.text)}</span>`,
      )
    }
    lastIndex = seg.end
  }
  parts.push(escapeHtml(lineText.slice(lastIndex)))
  return parts.join('')
}

function refreshRowEnhancements(
  rowEl: HTMLElement,
  highlightLinks: boolean,
  highlightLogLevels: boolean,
): void {
  if (rowEl.querySelector('.term-cursor')) return

  const text = rowEl.textContent ?? ''
  const shouldHighlightLinks = highlightLinks && lineTextHasUrl(text)
  const logSpans = highlightLogLevels ? getLogHighlightSpans(text) : []
  const html = buildEnhancedRowHtml(text, shouldHighlightLinks, logSpans)

  if (html) {
    rowEl.innerHTML = html
    rowEl.setAttribute(PROCESSED_ATTR, '1')
  } else if (rowEl.hasAttribute(PROCESSED_ATTR)) {
    // 恢复为纯文本
    rowEl.textContent = text
    rowEl.removeAttribute(PROCESSED_ATTR)
  }
}

function refreshLinkHighlights(
  root: HTMLElement,
  highlightLinks: boolean,
  highlightLogLevels: boolean,
  followScroll: boolean,
): void {
  if (!highlightLinks && !highlightLogLevels) {
    for (const row of root.querySelectorAll('.term-row')) {
      const rowEl = row as HTMLElement
      rowEl.removeAttribute(PROCESSED_ATTR)
    }
    return
  }

  const rows = root.querySelectorAll('.term-grid .term-row, .term-row')
  for (const row of rows) {
    refreshRowEnhancements(row as HTMLElement, highlightLinks, highlightLogLevels)
  }

  if (followScroll && isWtermNearBottom(root)) {
    queueWtermScrollToBottom(root)
  }
}

function bindRightClickBehavior(
  root: HTMLElement,
  options: Pick<WtermDomShellOptions, 'terminalId' | 'tabId' | 'rightClickCopyPaste' | 'advancedRightClickMenu'>,
  listeners: Array<() => void>,
  isAlternateScreen: () => boolean = () => false,
): void {
  const terminalSettings = {
    rightClickCopyPaste: options.rightClickCopyPaste,
    advancedRightClickMenu: options.advancedRightClickMenu,
  }
  const copyPasteEnabled = isTerminalRightClickCopyPasteEnabled(terminalSettings)
  const advancedMenuEnabled = isTerminalAdvancedRightClickMenuEnabled(terminalSettings)

  const captureOpts = { capture: true } as const

  const onRightMouseUp = (e: MouseEvent) => {
    if (e.button !== 2) return
    if (isAlternateScreen()) {
      if (copyPasteEnabled) {
        handleTerminalRightClickCopyPaste(
          options.terminalId,
          () => readTerminalSelectionText(),
          e,
        )
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      return
    }
    if (!copyPasteEnabled) return
    handleTerminalRightClickCopyPaste(
      options.terminalId,
      () => readTerminalSelectionText(),
      e,
    )
  }

  root.addEventListener('mouseup', onRightMouseUp, captureOpts)
  listeners.push(() => root.removeEventListener('mouseup', onRightMouseUp, captureOpts))

  if (!copyPasteEnabled && !advancedMenuEnabled) return

  const onContextMenu = (e: MouseEvent) => {
    if (copyPasteEnabled) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (!advancedMenuEnabled) return
    openTerminalAdvancedContextMenu(e, options.terminalId, options.tabId)
  }

  root.addEventListener('contextmenu', onContextMenu, captureOpts)
  listeners.push(() => root.removeEventListener('contextmenu', onContextMenu, captureOpts))
}

function bindInteractiveCliMouse(
  instance: WTerm,
  shiftEnterNewline: boolean,
  listeners: Array<() => void>,
): void {
  const onMouseDown = (event: MouseEvent) => {
    if (event.type !== 'mousedown') return
    if (event.button !== 0 && instance.bridge?.usingAltScreen()) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    if (event.button !== 0) return
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

  bindRightClickBehavior(
    root,
    options,
    listeners,
    () => instance.bridge?.usingAltScreen() ?? false,
  )
  const { highlightLinks, highlightLogLevels, clickToOpenLinks, shiftEnterNewline } = options.shell
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
    if (!highlightLinks && !highlightLogLevels) return
    cancelAnimationFrame(highlightFrame)
    highlightFrame = requestAnimationFrame(() => {
      const followScroll = isWtermNearBottom(root)
      refreshLinkHighlights(root, highlightLinks, highlightLogLevels, followScroll)
    })
  }

  if (highlightLinks || highlightLogLevels) {
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
    refreshLinkHighlights(root, false, false, false)
  }
}
