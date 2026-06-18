import type { BrowserWindow } from 'electron'
import {
  TERMINAL_OUTPUT_IPC_CHUNK_CHARS,
  TERMINAL_OUTPUT_PENDING_MAX_CHARS,
  appendTerminalOutputCapped,
  forEachTerminalOutputChunk,
} from '../shared/terminal-output-limits'
import { canSendToRenderer, sendToRenderer } from './window-ipc'

/**
 * 定时批量 flush terminal:data，减少主→渲染 IPC 次数。
 * 使用 16ms 间隔（≈60fps 上限）而非 setImmediate，
 * 避免高频 PTY 输出时每个事件循环 tick 都发一条 IPC。
 */
const FLUSH_INTERVAL_MS = 16

export function createTerminalOutputFlusher(getWindow: () => BrowserWindow | null) {
  const pending = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let paused = false

  function scheduleFlush(delayMs = FLUSH_INTERVAL_MS): void {
    if (paused || timer) return
    timer = setTimeout(flush, delayMs)
  }

  function flush(): void {
    timer = null
    if (paused) {
      scheduleFlush()
      return
    }
    const win = getWindow()
    if (!canSendToRenderer(win)) {
      pending.clear()
      return
    }
    for (const [id, data] of pending) {
      if (!data) continue
      forEachTerminalOutputChunk(data, TERMINAL_OUTPUT_IPC_CHUNK_CHARS, (chunk) => {
        sendToRenderer(win, 'terminal:data', id, chunk)
      })
    }
    pending.clear()
  }

  function queue(id: string, data: string): void {
    if (!data) return
    pending.set(
      id,
      appendTerminalOutputCapped(
        pending.get(id) ?? '',
        data,
        TERMINAL_OUTPUT_PENDING_MAX_CHARS,
      ),
    )
    scheduleFlush()
  }

  function pause(): void {
    paused = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function resume(): void {
    if (!paused) return
    paused = false
    if (pending.size > 0) {
      scheduleFlush(0)
    }
  }

  function dispose(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    paused = false
    pending.clear()
  }

  return { queue, flush, pause, resume, dispose }
}
