import type { AppSettings } from '../../electron/shared/api-types'
import {
  TERMINAL_OUTPUT_PENDING_MAX_CHARS,
  TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
  appendTerminalOutputCapped,
  findSafeTerminalOutputChunkEnd,
} from '../../electron/shared/terminal-output-limits'
import { TerminalFlowControl } from '@/lib/terminal-flow-control'
import {
  isTerminalRenderPaused,
  onTerminalRenderPaused,
  onTerminalRenderResumed,
} from '@/lib/terminal-render-pause'

export interface TerminalWriteBatcher {
  queue: (data: string, sourceTerminalId?: string) => void
  /** 丢弃 pending，用于 Tab 切换 / 进程退出前停止写入链 */
  dropPending: () => void
  dispose: () => void
}

export function createTerminalWriteBatcher(
  getTerm: () => { write: (data: string, callback?: () => void) => void } | null,
  getSettings: () => AppSettings | null | undefined,
  getTerminalId: () => string | null,
  ackOutput: (terminalId: string, length: number) => void,
): TerminalWriteBatcher {
  let pending = ''
  let pendingSourceId: string | null = null
  let pumping = false
  /** Tab 切换时递增，丢弃在途 xterm.write 完成后的续写，避免旧 Tab 文本污染新 Tab */
  let writeGeneration = 0
  const flowControl = new TerminalFlowControl()
  const unsubFlowUnblock = flowControl.onUnblock(() => {
    startPumpIfNeeded()
  })

  const stopPump = (): void => {
    pumping = false
  }

  const unsubPause = onTerminalRenderPaused(stopPump)
  const unsubResume = onTerminalRenderResumed(() => {
    startPumpIfNeeded()
  })

  const ackDroppedPending = (): void => {
    const dropped = pending.length
    if (pendingSourceId && dropped > 0) {
      ackOutput(pendingSourceId, dropped)
    }
  }

  const clearPending = (): void => {
    ackDroppedPending()
    pending = ''
    pendingSourceId = null
  }

  const pumpLoop = async (): Promise<void> => {
    const pumpGeneration = writeGeneration
    await flowControl.waitIfBlocked()

    if (pumpGeneration !== writeGeneration) {
      pumping = false
      return
    }

    if (isTerminalRenderPaused()) {
      pumping = false
      return
    }

    const boundId = getTerminalId()
    if (!boundId || !pendingSourceId || pendingSourceId !== boundId) {
      if (pending) clearPending()
      pumping = false
      return
    }

    const term = getTerm()
    if (!term || !pending) {
      pumping = false
      return
    }

    const chunkEnd = findSafeTerminalOutputChunkEnd(
      pending,
      0,
      TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
    )
    const chunk = pending.slice(0, chunkEnd)
    pending = pending.slice(chunkEnd)
    if (!pending) pendingSourceId = null

    const ackId = pendingSourceId ?? boundId
    flowControl.write(
      term,
      chunk,
      getSettings(),
      (length) => {
        if (ackId) ackOutput(ackId, length)
      },
      () => {
        if (pumpGeneration !== writeGeneration) {
          pumping = false
          return
        }
        if (isTerminalRenderPaused()) {
          pumping = false
          return
        }
        if (pending) void pumpLoop()
        else pumping = false
      },
    )
  }

  const startPumpIfNeeded = (): void => {
    if (pumping || !pending || isTerminalRenderPaused()) return
    if (flowControl.isBlocked) return
    pumping = true
    void pumpLoop()
  }

  return {
    queue(data: string, sourceTerminalId?: string) {
      if (!data) return
      const terminalId = sourceTerminalId ?? getTerminalId()
      if (!terminalId) return

      const boundId = getTerminalId()
      if (boundId != null && terminalId !== boundId) return

      if (pending.length > 0 && pendingSourceId != null && pendingSourceId !== terminalId) {
        clearPending()
      }

      pendingSourceId = terminalId
      pending = appendTerminalOutputCapped(
        pending,
        data,
        TERMINAL_OUTPUT_PENDING_MAX_CHARS,
      )
      if (!isTerminalRenderPaused()) startPumpIfNeeded()
    },
    dropPending() {
      writeGeneration += 1
      stopPump()
      clearPending()
      flowControl.reset()
    },
    dispose() {
      unsubPause()
      unsubResume()
      unsubFlowUnblock()
      writeGeneration += 1
      stopPump()
      clearPending()
      flowControl.reset()
    },
  }
}
