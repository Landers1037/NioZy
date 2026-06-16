import type { AppSettings } from '../../electron/shared/api-types'
import {
  TERMINAL_OUTPUT_PENDING_MAX_CHARS,
  TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
  appendTerminalOutputCapped,
} from '../../electron/shared/terminal-output-limits'
import { writeXtermOutput } from '@/lib/terminal-sync-output'

export interface TerminalWriteBatcher {
  queue: (data: string) => void
  /** 丢弃 pending，用于 Tab 切换 / 进程退出前停止写入链 */
  dropPending: () => void
  dispose: () => void
}

export function createTerminalWriteBatcher(
  getTerm: () => { write: (data: string, callback?: () => void) => void } | null,
  getSettings: () => AppSettings | null | undefined,
): TerminalWriteBatcher {
  let pending = ''
  let raf = 0
  let pumping = false

  const pumpNext = (): void => {
    const term = getTerm()
    if (!term || !pending) {
      pumping = false
      return
    }

    const chunk =
      pending.length <= TERMINAL_WRITE_FLUSH_CHUNK_CHARS
        ? pending
        : pending.slice(0, TERMINAL_WRITE_FLUSH_CHUNK_CHARS)
    pending = pending.slice(chunk.length)

    writeXtermOutput(term, chunk, getSettings(), () => {
      if (pending) pumpNext()
      else pumping = false
    })
  }

  const startPumpIfNeeded = (): void => {
    if (pumping || !pending) return
    pumping = true
    pumpNext()
  }

  const schedule = (): void => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      startPumpIfNeeded()
    })
  }

  return {
    queue(data: string) {
      if (!data) return
      pending = appendTerminalOutputCapped(
        pending,
        data,
        TERMINAL_OUTPUT_PENDING_MAX_CHARS,
      )
      schedule()
    },
    dropPending() {
      cancelAnimationFrame(raf)
      raf = 0
      pending = ''
      pumping = false
    },
    /** 卸载时丢弃 pending，不再写入即将销毁的 xterm */
    dispose() {
      cancelAnimationFrame(raf)
      raf = 0
      pending = ''
      pumping = false
    },
  }
}
