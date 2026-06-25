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

/** PTY 已通过 DECSET 开启 mouse reporting（Zellij / vim / less 等 TUI） */
export function isXtermMouseReportingActive(term: Terminal): boolean {
  return term.modes.mouseTrackingMode !== 'none'
}

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
  term.focus()
  return true
}

/**
 * 备用屏（vim / less / 交互式 CLI）左键拖选。
 *
 * 与 Tabby / xterm 原生行为对齐：备用屏启用 mouse reporting 时，SelectionService
 * 会禁用普通拖选，仅 Shift+点击（Windows）或 Option+点击（macOS）强制选区。
 * 因此**不拦截**无修饰键的单击，让 xterm 自行 focus、转发鼠标给 less/vim。
 * 仅在 Shift/Option+拖选时 capture 拦截，避免 SGR 序列污染 PTY。
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
    if (!forceModifier) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    attachPublicApiDragSelect(term, event, { requireDragThreshold: false, copyOnRelease: true })
    return true
  }

  // 备用屏（vim / less）：Alt+点击留给 xterm 的 altClickMovesCursor
  if (event.altKey && !forceModifier) return false

  if (shiftEnterNewline) {
    // TUI 已开启 mouse reporting：普通单击交给 xterm 转发 SGR（与 Tabby 一致）
    if (isXtermMouseReportingActive(term) && !forceModifier) return false

    // 交互式 CLI（通常无 mouse mode）：拦截单击，避免 xterm 默认行为；拖选后复制
    event.preventDefault()
    event.stopImmediatePropagation()
    term.focus()
    attachPublicApiDragSelect(term, event, { requireDragThreshold: true, copyOnRelease: true })
    return true
  }

  // 普通备用屏（less/vim）：无修饰键单击交给 xterm（焦点 + less 键盘交互）
  if (!forceModifier) return false

  event.preventDefault()
  event.stopImmediatePropagation()
  term.focus()
  attachPublicApiDragSelect(term, event, { requireDragThreshold: false, copyOnRelease: true })
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
      term.focus()
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
