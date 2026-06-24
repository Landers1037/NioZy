import type { AppSettings } from '../../electron/shared/api-types'
import {
  TERMINAL_OUTPUT_PENDING_MAX_CHARS,
  TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
  appendTerminalOutputCapped,
  findSafeTerminalOutputChunkEnd,
} from '../../electron/shared/terminal-output-limits'
import { writeXtermOutput } from '@/lib/terminal-sync-output'

/** Mux 全屏 redraw 帧较大且频繁，不走渲染层 FlowControl，避免反压拖死回显 */
export interface MuxTerminalWriteBatcher {
  queue: (data: string) => void
  dispose: () => void
}

export function createMuxTerminalWriteBatcher(
  getTerm: () => { write: (data: string, callback?: () => void) => void } | null,
  getSettings: () => AppSettings | null | undefined,
  getSessionId: () => string | null,
  ackOutput: (sessionId: string, length: number) => void,
): MuxTerminalWriteBatcher {
  let pending = ''
  let pumping = false

  const pump = (): void => {
    const term = getTerm()
    if (pumping || !term || !pending) return
    pumping = true
    const chunkEnd = findSafeTerminalOutputChunkEnd(
      pending,
      0,
      TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
    )
    const chunk = pending.slice(0, chunkEnd)
    pending = pending.slice(chunkEnd)
    const sessionId = getSessionId()
    writeXtermOutput(term, chunk, getSettings(), () => {
      if (sessionId) ackOutput(sessionId, chunk.length)
      pumping = false
      if (pending) pump()
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
      pump()
    },
    dispose() {
      pending = ''
      pumping = false
    },
  }
}
