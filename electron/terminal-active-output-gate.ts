import {
  TERMINAL_FLOW_MAX_CHUNK_CHARS,
  TERMINAL_FLOW_MAX_UNACKED_CHARS,
} from './shared/terminal-flow-limits'

export interface TerminalActiveOutputGateOptions {
  maxChunk?: number
  maxUnacked?: number
  onEmit: (chunk: string) => void
  onFlowPause: () => void
  onFlowResume: () => void
}

/**
 * 活跃终端推流闸门：限制未 ack 在途数据，超限时通过 onFlowPause 暂停 PTY/SSH 源。
 * 参考 Tabby app/lib/pty.ts PTYDataQueue。
 */
export class TerminalActiveOutputGate {
  private buffer = ''
  private unackedChars = 0
  private flowPaused = false
  private emitScheduled = false
  private readonly maxChunk: number
  private readonly maxUnacked: number

  constructor(private readonly options: TerminalActiveOutputGateOptions) {
    this.maxChunk = options.maxChunk ?? TERMINAL_FLOW_MAX_CHUNK_CHARS
    this.maxUnacked = options.maxUnacked ?? TERMINAL_FLOW_MAX_UNACKED_CHARS
  }

  push(data: string): void {
    if (!data) return
    this.buffer += data
    this.scheduleEmit()
  }

  ack(length: number): void {
    if (length <= 0) return
    this.unackedChars = Math.max(0, this.unackedChars - length)
    if (this.flowPaused && this.unackedChars <= this.maxUnacked) {
      this.flowPaused = false
      this.options.onFlowResume()
    }
    this.scheduleEmit()
  }

  /** Tab 休眠 / 切走时取出未推送缓冲，供写入 pausedOutput */
  drain(): string {
    const rest = this.buffer
    this.buffer = ''
    return rest
  }

  dispose(): void {
    this.buffer = ''
    this.unackedChars = 0
    this.emitScheduled = false
    if (this.flowPaused) {
      this.flowPaused = false
      this.options.onFlowResume()
    }
  }

  private scheduleEmit(): void {
    if (this.emitScheduled) return
    this.emitScheduled = true
    setImmediate(() => {
      this.emitScheduled = false
      this.emitPending()
    })
  }

  private emitPending(): void {
    while (this.buffer.length > 0) {
      if (this.unackedChars > this.maxUnacked) {
        this.pauseFlow()
        return
      }

      const chunk =
        this.buffer.length <= this.maxChunk
          ? this.buffer
          : this.buffer.slice(0, this.maxChunk)
      this.buffer = this.buffer.slice(chunk.length)
      this.unackedChars += chunk.length
      this.options.onEmit(chunk)

      if (this.unackedChars > this.maxUnacked) {
        this.pauseFlow()
        return
      }
    }
  }

  private pauseFlow(): void {
    if (this.flowPaused) return
    this.flowPaused = true
    this.options.onFlowPause()
  }
}
