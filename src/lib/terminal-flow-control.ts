import type { AppSettings } from '../../electron/shared/api-types'
import {
  TERMINAL_FLOW_BYTES_THRESHOLD,
  TERMINAL_FLOW_HIGH_WATERMARK,
  TERMINAL_FLOW_LOW_WATERMARK,
} from '../../electron/shared/terminal-flow-limits'
import { writeXtermOutput } from '@/lib/terminal-sync-output'

/**
 * 渲染层 xterm 写入流控：pending write callback 超水位时阻塞，避免 yes 洪水占满主线程。
 * 参考 Tabby tabby-terminal/src/frontends/xtermFrontend.ts FlowControl。
 */
export class TerminalFlowControl {
  private blocked = false
  private pendingCallbacks = 0
  private bytesSinceCallback = 0
  private resumeWaiters: Array<() => void> = []
  private unblockListeners = new Set<() => void>()

  get isBlocked(): boolean {
    return this.blocked
  }

  reset(): void {
    this.blocked = false
    this.pendingCallbacks = 0
    this.bytesSinceCallback = 0
    this.resumeWaiters = []
    this.unblockListeners.clear()
  }

  onUnblock(listener: () => void): () => void {
    this.unblockListeners.add(listener)
    return () => {
      this.unblockListeners.delete(listener)
    }
  }

  /** 阻塞时等待；pump 循环在开始前调用 */
  waitIfBlocked(): Promise<void> {
    if (!this.blocked) return Promise.resolve()
    return new Promise((resolve) => {
      this.resumeWaiters.push(resolve)
    })
  }

  write(
    term: { write: (data: string, callback?: () => void) => void },
    data: string,
    settings: AppSettings | null | undefined,
    onAck: (length: number) => void,
    onComplete?: () => void,
  ): void {
    if (!data) {
      onComplete?.()
      return
    }

    this.bytesSinceCallback += data.length
    const trackPending = this.bytesSinceCallback >= TERMINAL_FLOW_BYTES_THRESHOLD

    if (trackPending) {
      this.bytesSinceCallback = 0
      this.pendingCallbacks += 1
      if (!this.blocked && this.pendingCallbacks > TERMINAL_FLOW_HIGH_WATERMARK) {
        this.blocked = true
      }
    }

    writeXtermOutput(term, data, settings, () => {
      if (trackPending) {
        this.pendingCallbacks = Math.max(0, this.pendingCallbacks - 1)
        this.maybeUnblock()
      }
      onAck(data.length)
      onComplete?.()
    })
  }

  private maybeUnblock(): void {
    if (!this.blocked || this.pendingCallbacks >= TERMINAL_FLOW_LOW_WATERMARK) return
    this.blocked = false
    const waiters = this.resumeWaiters.splice(0)
    for (const resolve of waiters) resolve()
    for (const listener of this.unblockListeners) listener()
  }
}
