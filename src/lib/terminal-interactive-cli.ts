import type { Terminal } from '@xterm/xterm'
import { readTerminalSelectionText } from '@/lib/terminal-selection'

/** 移动超过该像素视为拖选（非单击） */
const SHIFT_SELECT_DRAG_THRESHOLD_PX = 4

/**
 * 交互式 CLI（Claude/Cursor agent 等）在备用屏常开启 xterm 鼠标追踪。
 * 点击输出区会把坐标发给 PTY，缓冲区光标会跳到点击处，与 TUI 自绘输入框光标错位。
 * 开启 shiftEnterNewline 时，在备用屏拦截普通左键单击，仅 refocus。
 * 备用屏上按住 Shift 左键拖选，松开时自动复制到剪贴板。
 */
export function handleInteractiveCliMouseDown(
  term: Terminal,
  event: MouseEvent,
  shiftEnterNewline: boolean,
): boolean {
  if (event.type !== 'mousedown' || event.button !== 0) return false
  if (term.buffer.active.type !== 'alternate') return false
  if (event.altKey) return false

  if (event.shiftKey) {
    attachShiftSelectCopyOnMouseUp(term, event)
    return false
  }

  if (!shiftEnterNewline) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  term.focus()
  return true
}

/** Shift+拖选结束后复制（xterm 由原生选区处理，不在此派发合成鼠标事件）。 */
export function attachShiftSelectCopyOnMouseUp(
  term: Terminal,
  event: MouseEvent,
): void {
  attachShiftSelectCopyOnMouseUpForElement(
    term.element,
    () => readTerminalSelectionText(term),
    event,
  )
}

export function attachShiftSelectCopyOnMouseUpForElement(
  root: HTMLElement | undefined,
  getSelectionText: () => string,
  downEvent: MouseEvent,
): void {
  if (!root) return

  const ownerDoc = root.ownerDocument ?? document
  const startX = downEvent.clientX
  const startY = downEvent.clientY

  const onUp = (e: MouseEvent) => {
    cleanup()
    if (e.button !== 0 || !e.shiftKey) return
    const dragged =
      Math.hypot(e.clientX - startX, e.clientY - startY) >= SHIFT_SELECT_DRAG_THRESHOLD_PX
    if (!dragged) return

    queueMicrotask(() => {
      const text = getSelectionText()
      if (text) void navigator.clipboard.writeText(text)
    })
  }

  const cleanup = () => {
    ownerDoc.removeEventListener('mouseup', onUp)
  }

  ownerDoc.addEventListener('mouseup', onUp)
}

/** 将浏览器选区更新为两点之间的文本（用于 wterm DOM 渲染器 Shift+拖选） */
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

/** wterm：Shift+左键拖选 DOM 文本，松开时复制 */
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
    if (
      Math.hypot(e.clientX - startX, e.clientY - startY) <
      SHIFT_SELECT_DRAG_THRESHOLD_PX
    ) {
      return
    }
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
