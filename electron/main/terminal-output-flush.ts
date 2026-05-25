import type { BrowserWindow } from 'electron'
import { sendToRenderer } from './window-ipc'

/** 同一事件循环内合并 terminal:data，减少主→渲染 IPC 次数。 */
export function createTerminalOutputFlusher(getWindow: () => BrowserWindow | null) {
  const pending = new Map<string, string>()
  let scheduled = false

  function flush(): void {
    scheduled = false
    const win = getWindow()
    if (!win) {
      pending.clear()
      return
    }
    for (const [id, data] of pending) {
      if (data) sendToRenderer(win, 'terminal:data', id, data)
    }
    pending.clear()
  }

  function queue(id: string, data: string): void {
    pending.set(id, (pending.get(id) ?? '') + data)
    if (!scheduled) {
      scheduled = true
      setImmediate(flush)
    }
  }

  function dispose(): void {
    pending.clear()
    scheduled = false
  }

  return { queue, flush, dispose }
}
