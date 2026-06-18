import type { ScreenshotViewportPayload } from '@/lib/terminal-screenshot-cells'
import type {
  TerminalScreenshotWorkerCommand,
  TerminalScreenshotWorkerEvent,
} from '@/workers/terminal-screenshot.worker'

let worker: Worker | null = null
const pending = new Map<
  string,
  { resolve: (bitmap: ImageBitmap) => void; reject: (err: Error) => void }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/terminal-screenshot.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<TerminalScreenshotWorkerEvent>) => {
      const data = event.data
      const entry = pending.get(data.requestId)
      if (!entry) return
      pending.delete(data.requestId)
      if (data.type === 'done') {
        entry.resolve(data.bitmap)
        return
      }
      entry.reject(new Error(data.message))
    }
    worker.onerror = (err) => {
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(new Error(err.message || 'Screenshot worker error'))
      }
    }
  }
  return worker
}

export function renderScreenshotInWorker(payload: ScreenshotViewportPayload): Promise<ImageBitmap> {
  const requestId = crypto.randomUUID()
  return new Promise<ImageBitmap>((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    getWorker().postMessage({
      type: 'render',
      requestId,
      payload,
    } satisfies TerminalScreenshotWorkerCommand)
  })
}

export function screenshotBitmapToCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0)
  }
  bitmap.close()
  return canvas
}
