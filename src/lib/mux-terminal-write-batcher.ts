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
): MuxTerminalWriteBatcher {
  let pending = ''

  const flush = (): void => {
    const term = getTerm()
    if (!term || !pending) return
    const settings = getSettings()
    while (pending.length > 0) {
      const chunkEnd = findSafeTerminalOutputChunkEnd(
        pending,
        0,
        TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
      )
      if (chunkEnd <= 0) break
      const chunk = pending.slice(0, chunkEnd)
      pending = pending.slice(chunkEnd)
      writeXtermOutput(term, chunk, settings)
    }
  }

  return {
    queue(data) {
      if (!data) return
      pending = appendTerminalOutputCapped(
        pending,
        data,
        TERMINAL_OUTPUT_PENDING_MAX_CHARS,
      )
      flush()
    },
    dispose() {
      pending = ''
    },
  }
}
