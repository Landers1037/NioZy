import type { Terminal } from '@xterm/xterm'
import type { IDisposable } from '@xterm/xterm'
import type { PreviewSettings } from '../../electron/shared/preview-settings'
import type { ShellSettings } from '../../electron/shared/shell-settings'
import { findUrlAtColumn } from '@/lib/terminal-url'
import {
  pickPreviewFileAtColumn,
  lineTextHasPreviewableFile,
  type TerminalFileMatch,
} from '@/lib/terminal-file-detect'
import { isAnyPreviewEnabled } from '@/lib/terminal-preview'
import {
  handleTerminalLinkClick,
  openTerminalFilePreview,
} from '@/lib/terminal-preview-open'
import {
  hideTerminalPreviewTooltip,
  showTerminalPreviewTooltip,
} from '@/lib/terminal-preview-tooltip'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import i18n from '@/lib/i18n'

const WTERM_LINK_CLASS = 'niozy-wterm-link'

export interface TerminalPreviewMouseContext {
  preview: PreviewSettings
  shell: ShellSettings
  isSsh: boolean
  getCwd: () => string | undefined
}

type PreviewTarget =
  | { kind: 'file'; match: TerminalFileMatch }
  | { kind: 'url'; url: string }

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

function shouldShowPreviewHint(ctx: TerminalPreviewMouseContext): boolean {
  return isAnyPreviewEnabled(ctx.preview)
}

function getPreviewTargetAt(
  lineText: string,
  col: number,
  ctx: TerminalPreviewMouseContext,
): PreviewTarget | null {
  const file = pickPreviewFileAtColumn(lineText, col, ctx.preview, ctx.getCwd())
  if (file) return { kind: 'file', match: file }

  const url = findUrlAtColumn(lineText, col)
  if (url && ctx.preview.linkPreview) return { kind: 'url', url }

  return null
}

function isCtrlPreviewClick(event: MouseEvent): boolean {
  return event.button === 0 && event.ctrlKey && !event.shiftKey && !event.altKey
}

function clearNativeSelection(): void {
  if (typeof window === 'undefined') return
  window.getSelection()?.removeAllRanges()
}

function clearTerminalSelection(term?: Terminal | null): void {
  clearNativeSelection()
  term?.clearSelection()
}

function setPreviewCursor(el: HTMLElement | null, pointer: boolean): void {
  if (!el) return
  el.style.cursor = pointer ? 'pointer' : ''
}

function handlePreviewMouseDown(
  lineText: string,
  col: number,
  event: MouseEvent,
  ctx: TerminalPreviewMouseContext,
): boolean {
  if (!isCtrlPreviewClick(event)) return false
  const target = getPreviewTargetAt(lineText, col, ctx)
  if (!target) return false

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  return true
}

function handlePreviewMouseUp(
  lineText: string,
  col: number,
  event: MouseEvent,
  ctx: TerminalPreviewMouseContext,
  term?: Terminal | null,
): boolean {
  if (event.button !== 0) return false

  if (event.ctrlKey) {
    const previewTarget = getPreviewTargetAt(lineText, col, ctx)
    if (previewTarget?.kind === 'file') {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      clearTerminalSelection(term)
      void openTerminalFilePreview(previewTarget.match.path, previewTarget.match.kind, {
        isSsh: ctx.isSsh,
      })
      return true
    }
    if (previewTarget?.kind === 'url') {
      const handled = handleTerminalLinkClick(
        previewTarget.url,
        event,
        ctx.preview,
        ctx.shell.clickToOpenLinks,
      )
      if (handled) clearTerminalSelection(term)
      return handled
    }
    return false
  }

  if (readTerminalSelectionText(term).length > 0) return false

  const url = findUrlAtColumn(lineText, col)
  if (url && ctx.shell.clickToOpenLinks) {
    return handleTerminalLinkClick(url, event, ctx.preview, true)
  }

  return false
}

function handlePreviewHover(
  lineText: string,
  col: number,
  event: MouseEvent,
  ctx: TerminalPreviewMouseContext,
  cursorEl: HTMLElement | null,
): void {
  const previewTarget = getPreviewTargetAt(lineText, col, ctx)
  const showPointer = event.ctrlKey && previewTarget !== null
  setPreviewCursor(cursorEl, showPointer)

  if (!shouldShowPreviewHint(ctx)) {
    hideTerminalPreviewTooltip()
    return
  }

  if (previewTarget) {
    showTerminalPreviewTooltip(event.clientX, event.clientY, i18n.t('settings.preview.ctrlClickHint'))
    return
  }
  hideTerminalPreviewTooltip()
}

function bindSelectStartGuard(root: HTMLElement, listeners: Array<() => void>): void {
  const onSelectStart = (event: Event) => {
    const e = event as Event & { ctrlKey?: boolean }
    if (e.ctrlKey) {
      event.preventDefault()
    }
  }
  root.addEventListener('selectstart', onSelectStart, true)
  listeners.push(() => root.removeEventListener('selectstart', onSelectStart, true))
}

export function bindDomTerminalPreview(
  root: HTMLElement,
  ctx: TerminalPreviewMouseContext,
  getColFromMouseEvent: (rowEl: HTMLElement, event: MouseEvent) => number | null,
  listeners: Array<() => void>,
): void {
  if (!shouldShowPreviewHint(ctx) && !ctx.shell.clickToOpenLinks) return

  let cursorRow: HTMLElement | null = null

  const resetCursor = () => {
    setPreviewCursor(cursorRow, false)
    cursorRow = null
  }

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement

    if (ctx.shell.highlightLinks && target.closest(`.${WTERM_LINK_CLASS}`) && event.ctrlKey) {
      const url = target.closest(`.${WTERM_LINK_CLASS}`)?.textContent?.trim()
      if (url && ctx.preview.linkPreview) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return
      }
    }

    const rowEl = target.closest('.term-row') as HTMLElement | null
    if (!rowEl || !root.contains(rowEl)) return
    const col = getColFromMouseEvent(rowEl, event)
    if (col === null) return
    handlePreviewMouseDown(rowEl.textContent ?? '', col, event, ctx)
  }

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement

    if (ctx.shell.highlightLinks && target.closest(`.${WTERM_LINK_CLASS}`)) {
      const url = target.closest(`.${WTERM_LINK_CLASS}`)?.textContent?.trim()
      if (url && handleTerminalLinkClick(url, event, ctx.preview, ctx.shell.clickToOpenLinks)) {
        clearNativeSelection()
        return
      }
    }

    const rowEl = target.closest('.term-row') as HTMLElement | null
    if (!rowEl || !root.contains(rowEl)) return
    const col = getColFromMouseEvent(rowEl, event)
    if (col === null) return
    if (handlePreviewMouseUp(rowEl.textContent ?? '', col, event, ctx)) {
      resetCursor()
    }
  }

  const onMouseMove = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const rowEl = target.closest('.term-row') as HTMLElement | null
    if (!rowEl || !root.contains(rowEl)) {
      resetCursor()
      hideTerminalPreviewTooltip()
      return
    }
    const col = getColFromMouseEvent(rowEl, event)
    if (col === null) {
      resetCursor()
      hideTerminalPreviewTooltip()
      return
    }
    if (cursorRow !== rowEl) {
      setPreviewCursor(cursorRow, false)
      cursorRow = rowEl
    }
    handlePreviewHover(rowEl.textContent ?? '', col, event, ctx, rowEl)
  }

  const onMouseLeave = () => {
    resetCursor()
    hideTerminalPreviewTooltip()
  }

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control') resetCursor()
  }

  bindSelectStartGuard(root, listeners)

  const captureOpts = { capture: true } as const
  root.addEventListener('mousedown', onMouseDown, captureOpts)
  root.addEventListener('mouseup', onMouseUp, captureOpts)
  root.addEventListener('mousemove', onMouseMove, captureOpts)
  root.addEventListener('mouseleave', onMouseLeave, captureOpts)
  window.addEventListener('keyup', onKeyUp)
  listeners.push(() => {
    root.removeEventListener('mousedown', onMouseDown, captureOpts)
    root.removeEventListener('mouseup', onMouseUp, captureOpts)
    root.removeEventListener('mousemove', onMouseMove, captureOpts)
    root.removeEventListener('mouseleave', onMouseLeave, captureOpts)
    window.removeEventListener('keyup', onKeyUp)
    resetCursor()
    hideTerminalPreviewTooltip()
  })
}

export function bindXtermTerminalPreview(
  term: Terminal,
  ctx: TerminalPreviewMouseContext,
  listeners: IDisposable[],
): void {
  if (!shouldShowPreviewHint(ctx) && !ctx.shell.clickToOpenLinks) return
  const el = term.element
  if (!el) return

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return
    const cell = getViewportCellFromMouse(term, event)
    if (!cell) return
    const bufferLine = term.buffer.active.viewportY + cell.row
    const line = term.buffer.active.getLine(bufferLine)
    if (!line) return
    handlePreviewMouseDown(line.translateToString(false), cell.col, event, ctx)
  }

  const onMouseUp = (event: MouseEvent) => {
    const cell = getViewportCellFromMouse(term, event)
    if (!cell) return
    const bufferLine = term.buffer.active.viewportY + cell.row
    const line = term.buffer.active.getLine(bufferLine)
    if (!line) return
    handlePreviewMouseUp(line.translateToString(false), cell.col, event, ctx, term)
  }

  const onMouseMove = (event: MouseEvent) => {
    const cell = getViewportCellFromMouse(term, event)
    if (!cell) {
      setPreviewCursor(el, false)
      hideTerminalPreviewTooltip()
      return
    }
    const bufferLine = term.buffer.active.viewportY + cell.row
    const line = term.buffer.active.getLine(bufferLine)
    if (!line) {
      setPreviewCursor(el, false)
      hideTerminalPreviewTooltip()
      return
    }
    const lineText = line.translateToString(false)
    if (
      !lineTextHasPreviewableFile(lineText, ctx.preview, ctx.getCwd()) &&
      !findUrlAtColumn(lineText, cell.col)
    ) {
      setPreviewCursor(el, false)
      hideTerminalPreviewTooltip()
      return
    }
    handlePreviewHover(lineText, cell.col, event, ctx, el)
  }

  const onMouseLeave = () => {
    setPreviewCursor(el, false)
    hideTerminalPreviewTooltip()
  }

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control') setPreviewCursor(el, false)
  }

  const onSelectStart = (event: Event) => {
    const e = event as Event & { ctrlKey?: boolean }
    if (e.ctrlKey) event.preventDefault()
  }

  const opts = { capture: true } as const
  el.addEventListener('mousedown', onMouseDown, opts)
  el.addEventListener('mouseup', onMouseUp, opts)
  el.addEventListener('mousemove', onMouseMove, opts)
  el.addEventListener('mouseleave', onMouseLeave, opts)
  el.addEventListener('selectstart', onSelectStart, opts)
  window.addEventListener('keyup', onKeyUp)
  listeners.push({
    dispose: () => {
      el.removeEventListener('mousedown', onMouseDown, opts)
      el.removeEventListener('mouseup', onMouseUp, opts)
      el.removeEventListener('mousemove', onMouseMove, opts)
      el.removeEventListener('mouseleave', onMouseLeave, opts)
      el.removeEventListener('selectstart', onSelectStart, opts)
      window.removeEventListener('keyup', onKeyUp)
      setPreviewCursor(el, false)
      hideTerminalPreviewTooltip()
    },
  })
}
