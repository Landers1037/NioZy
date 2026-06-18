import type { AppSettings } from '../../electron/shared/api-types'
import {
  TERMINAL_OUTPUT_PENDING_MAX_CHARS,
  TERMINAL_WRITE_FLUSH_CHUNK_CHARS,
  appendTerminalOutputCapped,
} from '../../electron/shared/terminal-output-limits'
import { TerminalFlowControl } from '@/lib/terminal-flow-control'
import {
  isTerminalRenderPaused,
  onTerminalRenderPaused,
  onTerminalRenderResumed,
} from '@/lib/terminal-render-pause'

export interface TerminalWriteBatcher {
  queue: (data: string) => void
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
  let pumping = false
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

  const pumpLoop = async (): Promise<void> => {
    await flowControl.waitIfBlocked()

    if (isTerminalRenderPaused()) {
      pumping = false
      return
    }

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

    const terminalId = getTerminalId()
    flowControl.write(
      term,
      chunk,
      getSettings(),
      (length) => {
        if (terminalId) ackOutput(terminalId, length)
      },
      () => {
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

  const ackDroppedPending = (): void => {
    const terminalId = getTerminalId()
    const dropped = pending.length
    if (terminalId && dropped > 0) {
      ackOutput(terminalId, dropped)
    }
  }

  return {
    queue(data: string) {
      if (!data) return
      pending = appendTerminalOutputCapped(
        pending,
        data,
        TERMINAL_OUTPUT_PENDING_MAX_CHARS,
      )
      if (!isTerminalRenderPaused()) startPumpIfNeeded()
    },
    dropPending() {
      ackDroppedPending()
      stopPump()
      pending = ''
    },
    dispose() {
      unsubPause()
      unsubResume()
      unsubFlowUnblock()
      ackDroppedPending()
      stopPump()
      pending = ''
      flowControl.reset()
    },
  }
}
