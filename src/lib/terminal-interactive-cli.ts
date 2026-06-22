import type { Terminal } from '@xterm/xterm'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import {
  applyXtermSelection,
  getViewportCellFromMouse,
  isXtermForceSelectionMouseEvent,
  viewportRowToBufferRow,
} from '@/lib/xterm-mouse-selection'

/** 移动超过该像素才视为拖选（非单击） */
const SHIFT_SELECT_DRAG_THRESHOLD_PX = 4

/**
 * 备用屏（less / vim）非左键：阻止 xterm 向 PTY 转发 SGR 鼠标序列，
 * 以及 mousedown 触发的 focus 报告（`ESC [I` / `ESC [O`）。
 */
export function blockAlternateScreenNonPrimaryMouse(
  term: Terminal,
  event: MouseEvent,
): boolean {
  if (term.buffer.active.type !== 'alternate') return false
  if (event.button === 0) return false
  event.preventDefault()
  event.stopImmediatePropagation()
  return true
}

/**
 * 备用屏（vim / less / 交互式 CLI）左键拖选。
 *
 * 原理：在 capture 阶段拦截 mousedown，阻止原始事件到达 xterm 的 "always-on"
 * mousedown 处理器（该处理器会把鼠标事件转发给 PTY）；同时在 mousemove 期间通过
 * xterm 公开 API term.select() 直接写入选区，无需依赖 SelectionService 的内部
 * mousedown 触发机制，彻底绕过 PTY mouse reporting。
 */
export function handleInteractiveCliMouseDown(
  term: Terminal,
  event: MouseEvent,
  shiftEnterNewline: boolean,
): boolean {
  if (event.type !== 'mousedown' || event.button !== 0) return false
  if (event.ctrlKey && !event.shiftKey && !event.altKey) return false

  const macOptionForces = term.options.macOptionClickForcesSelection
  const forceModifier = isXtermForceSelectionMouseEvent(event, macOptionForces)

  // 主缓冲区：Shift/Option 强制选区，松开后复制
  if (term.buffer.active.type !== 'alternate') {
    if (forceModifier) {
      attachPublicApiDragSelect(term, event, { requireDragThreshold: false, copyOnRelease: true })
    }
    return false
  }

  // 备用屏（vim 等）
  if (event.altKey && !forceModifier) return false

  event.preventDefault()
  event.stopImmediatePropagation()

  if (shiftEnterNewline) {
    // 交互式 CLI：单击不拦截，拖选后复制
    attachPublicApiDragSelect(term, event, { requireDragThreshold: true, copyOnRelease: true })
  } else {
    // 普通备用屏（vim/less）：直接左键拖选
    attachPublicApiDragSelect(term, event, { requireDragThreshold: false, copyOnRelease: true })
  }

  return true
}

/**
 * 用 term.select() 实现鼠标拖选，无需合成事件。
 * - requireDragThreshold：需超过 4px 才开始选区（交互式 CLI 单击不选中）
 * - copyOnRelease：松开鼠标后自动复制到剪贴板
 */
function attachPublicApiDragSelect(
  term: Terminal,
  downEvent: MouseEvent,
  options: { requireDragThreshold: boolean; copyOnRelease: boolean },
): void {
  const ownerDoc = term.element?.ownerDocument ?? document
  const startX = downEvent.clientX
  const startY = downEvent.clientY

  const startCell = getViewportCellFromMouse(term, downEvent)
  let startBufCol = startCell?.col ?? 0
  let startBufRow = startCell ? viewportRowToBufferRow(term, startCell.row) : 0
  let dragStarted = false

  const onMove = (e: MouseEvent) => {
    if ((e.buttons & 1) === 0) return

    if (options.requireDragThreshold && !dragStarted) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < SHIFT_SELECT_DRAG_THRESHOLD_PX) {
        return
      }
      dragStarted = true
    } else if (!options.requireDragThreshold) {
      dragStarted = true
    }

    const cell = getViewportCellFromMouse(term, e)
    if (!cell) return
    const endBufRow = viewportRowToBufferRow(term, cell.row)
    applyXtermSelection(term, startBufCol, startBufRow, cell.col, endBufRow)
  }

  const onUp = (e: MouseEvent) => {
    cleanup()
    if (e.button !== 0) return
    if (!dragStarted) {
      if (options.requireDragThreshold) term.focus()
      return
    }
    if (options.copyOnRelease) {
      queueMicrotask(() => {
        const text = readTerminalSelectionText(term)
        if (text) void navigator.clipboard.writeText(text)
      })
    }
  }

  const cleanup = () => {
    ownerDoc.removeEventListener('mousemove', onMove)
    ownerDoc.removeEventListener('mouseup', onUp)
  }

  ownerDoc.addEventListener('mousemove', onMove)
  ownerDoc.addEventListener('mouseup', onUp)
}

// ---------------------------------------------------------------------------
// 保留供 wterm DOM 渲染器使用的辅助函数
// ---------------------------------------------------------------------------

/** 将浏览器选区更新为两点之间的文本（wterm DOM 渲染器 Shift+拖选） */
export function extendNativeSelection(
  doc: Document,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  const sel = doc.getSelection()
  if (!sel) return

  const start = caretRangeFromClientPoint(doc, startX, startY)
  const end = caretRangeFromClientPoint(doc, endX, endY)
  if (!start || !end) return

  const range = doc.createRange()
  if ('startContainer' in start) {
    const startRange = start as Range
    const endRange = end as Range
    const cmp = startRange.compareBoundaryPoints(Range.START_TO_END, endRange)
    if (cmp <= 0) {
      range.setStart(startRange.startContainer, startRange.startOffset)
      range.setEnd(endRange.startContainer, endRange.startOffset)
    } else {
      range.setStart(endRange.startContainer, endRange.startOffset)
      range.setEnd(startRange.startContainer, startRange.startOffset)
    }
  } else {
    const row = (start as { offsetNode: Node }).offsetNode
    const text = row.textContent ?? ''
    const a = (start as { offset: number }).offset
    const b = (end as { offset: number }).offset
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    if (row.nodeType === Node.TEXT_NODE) {
      range.setStart(row, from)
      range.setEnd(row, to)
    } else if (text.length > 0 && row.firstChild?.nodeType === Node.TEXT_NODE) {
      const node = row.firstChild
      range.setStart(node, Math.min(from, text.length))
      range.setEnd(node, Math.min(to, text.length))
    } else {
      return
    }
  }

  sel.removeAllRanges()
  sel.addRange(range)
}

function caretRangeFromClientPoint(
  doc: Document,
  x: number,
  y: number,
): Range | { offsetNode: Node; offset: number } | null {
  if (doc.caretRangeFromPoint) {
    return doc.caretRangeFromPoint(x, y)
  }
  const caretPositionFromPoint = (
    doc as Document & {
      caretPositionFromPoint?: (px: number, py: number) => { offsetNode: Node; offset: number } | null
    }
  ).caretPositionFromPoint
  return caretPositionFromPoint?.call(doc, x, y) ?? null
}

/** wterm DOM 渲染器：Shift+左键拖选后复制 */
export function attachAlternateScreenShiftDomSelect(
  root: HTMLElement,
  event: MouseEvent,
  onCopyAfterDrag: () => void,
): () => void {
  const ownerDoc = root.ownerDocument ?? document
  const startX = event.clientX
  const startY = event.clientY
  let dragActive = false

  const onMove = (e: MouseEvent) => {
    if (!e.shiftKey) return
    if (dragActive) {
      extendNativeSelection(ownerDoc, startX, startY, e.clientX, e.clientY)
      return
    }
    if (Math.hypot(e.clientX - startX, e.clientY - startY) < SHIFT_SELECT_DRAG_THRESHOLD_PX) return
    dragActive = true
    extendNativeSelection(ownerDoc, startX, startY, e.clientX, e.clientY)
  }

  const onUp = (e: MouseEvent) => {
    cleanup()
    if (e.button !== 0 || !dragActive || !e.shiftKey) return
    extendNativeSelection(ownerDoc, startX, startY, e.clientX, e.clientY)
    onCopyAfterDrag()
  }

  const cleanup = () => {
    ownerDoc.removeEventListener('mousemove', onMove)
    ownerDoc.removeEventListener('mouseup', onUp)
  }

  ownerDoc.addEventListener('mousemove', onMove)
  ownerDoc.addEventListener('mouseup', onUp)
  return cleanup
}

export function applyInteractiveCliTerminalOptions(term: Terminal, shiftEnterNewline: boolean): void {
  term.options.altClickMovesCursor = !shiftEnterNewline
  term.options.macOptionClickForcesSelection = true
}
