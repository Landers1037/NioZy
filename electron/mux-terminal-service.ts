import { EventEmitter } from 'events'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import { randomUUID } from 'crypto'
import { getMuxCoreBinaryPath } from './mux-binary-path'
import { resolveMuxSpawnParams } from './mux-terminal-spawn'
import { appendTerminalOutputCapped } from './shared/terminal-output-limits'
import { terminalLog, logErrorPayload } from './app-log'
import type { MuxTerminalCreateOptions, MuxTerminalSession } from './shared/mux-terminal-types'
import { normalizeMuxPaneCount } from './shared/mux-terminal-types'
import type { AppSettings } from './shared/api-types'

const MAX_PAUSED_OUTPUT_CHARS = 512 * 1024
/** claimStream 等待 core 首帧输出的最长时间（PTY 冷启动可能 >100ms） */
const CLAIM_STREAM_WAIT_MS = 800

interface MuxSessionRecord {
  id: string
  name: string
  shell: string
  cwd: string
  paneCount: 1 | 2 | 4
  focusPane: number
}

type StreamPauseReason = 'inactive'

interface MuxStreamDiag {
  coreOutputCount: number
  coreOutputBytes: number
  ipcEmitCount: number
  ipcEmitBytes: number
  lastSeq: number
}

export class MuxTerminalService extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null
  private ready = false
  private starting: Promise<void> | null = null
  private readonly sessions = new Map<string, MuxSessionRecord>()
  private readonly activeStreamIds = new Set<string>()
  private readonly pausedOutput = new Map<string, string>()
  private readonly pausedStreamIds = new Set<string>()
  private readonly streamPauseReasons = new Map<string, Set<StreamPauseReason>>()
  private readonly streamDiag = new Map<string, MuxStreamDiag>()
  private readonly coreOutputSeen = new Set<string>()
  private readonly claimedStreamIds = new Set<string>()
  private readonly inputLoggedSessions = new Set<string>()

  constructor(private readonly getSettings: () => AppSettings) {
    super()
  }

  async create(options: MuxTerminalCreateOptions): Promise<MuxTerminalSession> {
    await this.ensureProcess()
    const spawn = resolveMuxSpawnParams(options, this.getSettings())
    const id = randomUUID()
    const cols = options.cols ?? 120
    const rows = options.rows ?? 40
    const paneCount = normalizeMuxPaneCount(options.paneCount)

    terminalLog.info('Mux sending spawn_session', {
      id,
      cols,
      rows,
      shell: spawn.shell,
      paneCount,
      argCount: spawn.args.length,
    })
    this.send({
      type: 'spawn_session',
      session_id: id,
      cols,
      rows,
      shell: spawn.shell,
      args: spawn.args,
      env: spawn.env,
      cwd: spawn.cwd,
      pane_count: paneCount,
    })

    const session: MuxSessionRecord = {
      id,
      name: spawn.name,
      shell: spawn.shellType,
      cwd: spawn.cwd,
      paneCount,
      focusPane: 0,
    }
    this.sessions.set(id, session)
    terminalLog.info('Mux session created', { id, paneCount, shell: spawn.shellType })
    return {
      id,
      name: spawn.name,
      shell: spawn.shellType,
      cwd: spawn.cwd,
      paneCount,
    }
  }

  write(id: string, data: string, paneIndex?: number): void {
    if (!this.sessions.has(id) || !data) return
    if (!this.inputLoggedSessions.has(id)) {
      this.inputLoggedSessions.add(id)
      terminalLog.info('Mux first input', {
        id,
        bytes: data.length,
        paneIndex: paneIndex ?? 0,
        preview: data.slice(0, 8).replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
      })
    }
    this.send({
      type: 'write_input',
      session_id: id,
      pane_index: paneIndex,
      data_b64: Buffer.from(data, 'utf8').toString('base64'),
    })
  }

  resize(id: string, cols: number, rows: number): void {
    if (!this.sessions.has(id)) return
    this.send({ type: 'resize', session_id: id, cols, rows })
  }

  setFocus(id: string, paneIndex: number): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.focusPane = paneIndex
    this.send({ type: 'set_focus', session_id: id, pane_index: paneIndex })
  }

  kill(id: string): void {
    if (!this.sessions.has(id)) return
    this.send({ type: 'kill_session', session_id: id })
    this.disposeSession(id, 0)
  }

  isAlive(id: string): boolean {
    return this.sessions.has(id)
  }

  setActiveStreams(ids: string[]): void {
    const next = new Set(ids.filter((id) => this.sessions.has(id)))
    for (const id of [...this.activeStreamIds]) {
      if (!next.has(id)) {
        this.pauseSessionStream(id)
        this.activeStreamIds.delete(id)
      }
    }
    for (const id of next) {
      if (!this.claimedStreamIds.has(id) || this.activeStreamIds.has(id)) continue
      this.activeStreamIds.add(id)
      this.resumeSessionStream(id)
      this.flushPausedToActive(id)
    }
    terminalLog.info('Mux setActiveStreams', {
      ids: [...next],
      claimedIds: [...next].filter((id) => this.claimedStreamIds.has(id)),
      activeIds: [...this.activeStreamIds],
      pausedBytes: Object.fromEntries(
        [...next].map((id) => [id, (this.pausedOutput.get(id) ?? '').length]),
      ),
    })
  }

  async claimStream(id: string, waitMs = CLAIM_STREAM_WAIT_MS): Promise<string> {
    if (!this.sessions.has(id)) {
      terminalLog.warn('Mux claimStream: unknown session', { id })
      return ''
    }
    const deadline = Date.now() + waitMs
    while (!this.hasClaimableOutput(id) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!this.hasClaimableOutput(id)) {
      terminalLog.warn('Mux claimStream: timed out waiting for core output', {
        id,
        waitMs,
        pausedBytes: (this.pausedOutput.get(id) ?? '').length,
      })
    }
    return this.drainClaimStream(id)
  }

  private hasClaimableOutput(id: string): boolean {
    if ((this.pausedOutput.get(id)?.length ?? 0) > 0) return true
    return this.coreOutputSeen.has(id)
  }

  private drainClaimStream(id: string): string {
    const newlyClaimed = !this.claimedStreamIds.has(id)
    this.claimedStreamIds.add(id)
    const pausedBefore = this.pausedOutput.get(id) ?? ''
    const replay = appendTerminalOutputCapped(pausedBefore, '', MAX_PAUSED_OUTPUT_CHARS)
    this.pausedOutput.delete(id)
    if (!this.activeStreamIds.has(id)) {
      this.activeStreamIds.add(id)
      this.resumeSessionStream(id)
    }
    terminalLog.info('Mux claimStream', {
      id,
      replayBytes: replay.length,
      pausedBytes: pausedBefore.length,
      newlyClaimed,
    })
    return replay
  }

  private flushPausedToActive(id: string): void {
    const buffered = this.pausedOutput.get(id)
    if (!buffered) return
    this.pausedOutput.delete(id)
    this.pushOutput(id, buffered)
  }

  ackActiveOutput(_id: string, _length: number): void {
    /* Mux 输出直推 IPC，不依赖渲染层 ack 反压 */
  }

  dispose(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id)
    }
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.ready = false
  }

  private async ensureProcess(): Promise<void> {
    if (this.process && this.ready) return
    if (this.starting) return this.starting

    this.starting = new Promise<void>((resolve, reject) => {
      const binary = getMuxCoreBinaryPath()
      if (!binary) {
        reject(
          new Error(
            '未找到 niozy-mux-core 可执行文件。请在 niozy-mux-core 目录运行 cargo build --release。',
          ),
        )
        return
      }

      terminalLog.info('Starting niozy-mux-core', { binary })
      const child = spawn(binary, ['serve', '--transport', 'stdio'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      this.process = child

      const rl = createInterface({ input: child.stdout })
      rl.on('line', (line) => this.handleLine(line))

      child.stderr.on('data', (chunk: Buffer) => {
        terminalLog.info('niozy-mux-core stderr', { text: chunk.toString('utf8').trim() })
      })

      child.on('error', (err) => {
        terminalLog.error('niozy-mux-core process error', logErrorPayload(err))
        this.process = null
        this.ready = false
        this.starting = null
        reject(err)
      })

      child.on('exit', (code) => {
        terminalLog.warn('niozy-mux-core exited', { code })
        this.process = null
        this.ready = false
        this.starting = null
        for (const id of [...this.sessions.keys()]) {
          this.disposeSession(id, code ?? 1)
        }
      })

      const onReady = () => {
        this.ready = true
        this.starting = null
        resolve()
      }

      const readyTimeout = setTimeout(() => {
        if (!this.ready) {
          reject(new Error('niozy-mux-core 启动超时（未收到 ready 事件）'))
        }
      }, 10_000)

      this.once('__ready', () => {
        clearTimeout(readyTimeout)
        onReady()
      })
    })

    return this.starting
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.process?.stdin.writable) {
      terminalLog.warn('mux stdin not writable', { type: payload.type })
      return
    }
    this.process.stdin.write(`${JSON.stringify(payload)}\n`)
  }

  private handleLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>
    } catch (err) {
      terminalLog.warn('mux invalid json line', { line: trimmed.slice(0, 200), ...logErrorPayload(err) })
      return
    }

    switch (event.type) {
      case 'ready':
        terminalLog.info('Mux core ready (stdio)')
        this.emit('__ready')
        break
      case 'output': {
        const sessionId = String(event.session_id ?? '')
        const dataB64 = String(event.data_b64 ?? '')
        const seq = Number(event.seq ?? 0)
        if (!sessionId || !dataB64) {
          terminalLog.warn('Mux core output ignored (missing fields)', {
            sessionId: sessionId || undefined,
            hasData: Boolean(dataB64),
            seq,
          })
          break
        }
        const text = Buffer.from(dataB64, 'base64').toString('utf8')
        this.recordCoreOutput(sessionId, text.length, seq)
        this.pushOutput(sessionId, text)
        break
      }
      case 'cwd_changed': {
        const sessionId = String(event.session_id ?? '')
        const paneIndex = Number(event.pane_index ?? 0)
        const cwd = String(event.cwd ?? '')
        const session = this.sessions.get(sessionId)
        if (session && cwd) {
          session.cwd = cwd
          this.emit('cwd', sessionId, paneIndex, cwd)
        }
        break
      }
      case 'session_exit': {
        const sessionId = String(event.session_id ?? '')
        this.disposeSession(sessionId, 0)
        break
      }
      case 'pane_exit': {
        const sessionId = String(event.session_id ?? '')
        const code = Number(event.code ?? 0)
        this.emit('paneExit', sessionId, Number(event.pane_index ?? 0), code)
        break
      }
      case 'error':
        terminalLog.error('mux core error', { message: String(event.message ?? '') })
        break
      default:
        break
    }
  }

  private pushOutput(id: string, data: string): void {
    if (!this.sessions.has(id)) {
      terminalLog.warn('Mux output dropped (unknown session)', { id, bytes: data.length })
      return
    }
    if (!this.activeStreamIds.has(id)) {
      const prev = this.pausedOutput.get(id) ?? ''
      const next = appendTerminalOutputCapped(prev, data, MAX_PAUSED_OUTPUT_CHARS)
      this.pausedOutput.set(id, next)
      if (prev.length === 0) {
        terminalLog.info('Mux output buffered (stream inactive)', { id, bytes: data.length })
      } else {
        terminalLog.debug('Mux output buffered (stream inactive)', {
          id,
          bytes: data.length,
          pausedTotal: next.length,
        })
      }
      return
    }

    this.recordIpcEmit(id, data.length)
    this.emit('data', id, data)
  }

  private recordCoreOutput(sessionId: string, bytes: number, seq: number): void {
    this.coreOutputSeen.add(sessionId)
    let diag = this.streamDiag.get(sessionId)
    if (!diag) {
      diag = {
        coreOutputCount: 0,
        coreOutputBytes: 0,
        ipcEmitCount: 0,
        ipcEmitBytes: 0,
        lastSeq: 0,
      }
      this.streamDiag.set(sessionId, diag)
    }
    diag.coreOutputCount += 1
    diag.coreOutputBytes += bytes
    diag.lastSeq = seq
    if (diag.coreOutputCount === 1) {
      terminalLog.info('Mux core first output', { sessionId, bytes, seq })
      return
    }
    if (diag.coreOutputCount % 25 === 0) {
      terminalLog.debug('Mux core output stats', { sessionId, ...diag })
    }
  }

  private recordIpcEmit(sessionId: string, bytes: number): void {
    let diag = this.streamDiag.get(sessionId)
    if (!diag) {
      diag = {
        coreOutputCount: 0,
        coreOutputBytes: 0,
        ipcEmitCount: 0,
        ipcEmitBytes: 0,
        lastSeq: 0,
      }
      this.streamDiag.set(sessionId, diag)
    }
    diag.ipcEmitCount += 1
    diag.ipcEmitBytes += bytes
    if (diag.ipcEmitCount === 1) {
      terminalLog.info('Mux first IPC emit', { sessionId, bytes })
      return
    }
    if (diag.ipcEmitCount % 50 === 0) {
      terminalLog.debug('Mux IPC emit stats', { sessionId, ...diag })
    }
  }

  private disposeSession(id: string, code: number): void {
    if (!this.sessions.has(id)) return
    const diag = this.streamDiag.get(id)
    if (diag) {
      terminalLog.info('Mux session disposed', { id, code, ...diag })
      this.streamDiag.delete(id)
    } else {
      terminalLog.info('Mux session disposed', { id, code })
    }
    this.sessions.delete(id)
    this.claimedStreamIds.delete(id)
    this.coreOutputSeen.delete(id)
    this.inputLoggedSessions.delete(id)
    this.activeStreamIds.delete(id)
    this.pausedOutput.delete(id)
    this.streamPauseReasons.delete(id)
    this.pausedStreamIds.delete(id)
    this.emit('exit', id, code)
  }

  private pauseSessionStream(id: string): void {
    const reasons = this.streamPauseReasons.get(id)
    if (reasons?.has('inactive')) return
    this.addStreamPause(id, 'inactive')
  }

  private resumeSessionStream(id: string): void {
    this.removeStreamPause(id, 'inactive')
  }

  private addStreamPause(id: string, reason: StreamPauseReason): void {
    let reasons = this.streamPauseReasons.get(id)
    if (!reasons) {
      reasons = new Set()
      this.streamPauseReasons.set(id, reasons)
    }
    if (reasons.has(reason)) return
    reasons.add(reason)
    this.pausedStreamIds.add(id)
  }

  private removeStreamPause(id: string, reason: StreamPauseReason): void {
    const reasons = this.streamPauseReasons.get(id)
    if (!reasons?.has(reason)) return
    reasons.delete(reason)
    if (reasons.size === 0) {
      this.streamPauseReasons.delete(id)
      this.pausedStreamIds.delete(id)
    }
  }
}
