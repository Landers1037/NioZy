import type { ScreenshotViewportPayload } from '@/lib/terminal-screenshot-cells'

export type TerminalScreenshotWorkerCommand = {
  type: 'render'
  requestId: string
  payload: ScreenshotViewportPayload
}

export type TerminalScreenshotWorkerEvent =
  | { type: 'done'; requestId: string; bitmap: ImageBitmap }
  | { type: 'error'; requestId: string; message: string }

function rgbToCss(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function renderPayload(payload: ScreenshotViewportPayload): ImageBitmap {
  const { cssW, cssH, dpr, cols, rows, fontSize, fontFamily, lineHeight, bgDefault, cells } = payload
  const canvas = new OffscreenCanvas(Math.round(cssW * dpr), Math.round(cssH * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('OffscreenCanvas 2d unavailable')
  }
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

  return canvas.transferToImageBitmap()
}

self.onmessage = (event: MessageEvent<TerminalScreenshotWorkerCommand>) => {
  const data = event.data
  if (data.type !== 'render') return
  try {
    const bitmap = renderPayload(data.payload)
    const response: TerminalScreenshotWorkerEvent = {
      type: 'done',
      requestId: data.requestId,
      bitmap,
    }
    self.postMessage(response, { transfer: [bitmap] })
  } catch (err) {
    const response: TerminalScreenshotWorkerEvent = {
      type: 'error',
      requestId: data.requestId,
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(response)
  }
}
