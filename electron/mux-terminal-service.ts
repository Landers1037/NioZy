import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { terminalLog, logErrorPayload } from './app-log'
import { resolveMuxSpawnParams } from './mux-terminal-spawn'
import { ensureMuxDaemon, killMuxDaemon, MuxRpcClient, resolveMuxCoreRunMode } from './mux-rpc-client'
import type { MuxTerminalCreateOptions, MuxTerminalSession } from './shared/mux-terminal-types'
import { normalizeMuxPaneCount } from './shared/mux-terminal-types'
import type { AppSettings } from './shared/api-types'

const CLAIM_STREAM_WAIT_MS = 30_000

interface MuxSessionRecord {
  id: string
  name: string
  shell: string
  cwd: string
  paneCount: 1 | 2 | 4
}

export class MuxTerminalService extends EventEmitter {
  private rpc: MuxRpcClient | null = null
  private ready = false
  private starting: Promise<void> | null = null
  private readonly sessions = new Map<string, MuxSessionRecord>()
  private readonly activeStreamIds = new Set<string>()
  private readonly pausedOutput = new Map<string, string>()
  private readonly coreOutputSeen = new Set<string>()
  private readonly claimedStreamIds = new Set<string>()
  private readonly latestOutput = new Map<string, string>()
  private readonly inputLoggedSessions = new Set<string>()
  private readonly ipcEmitLoggedSessions = new Set<string>()
  private unsubscribers: Array<() => void> = []

  constructor(private readonly getSettings: () => AppSettings) {
    super()
  }

  async create(options: MuxTerminalCreateOptions): Promise<MuxTerminalSession> {
    await this.ensureConnected()
    const spawn = resolveMuxSpawnParams(options, this.getSettings())
    const id = randomUUID()
    const cols = options.cols ?? 120
    const rows = options.rows ?? 40
    const paneCount = normalizeMuxPaneCount(options.paneCount)

    // 须在 RPC 完成前注册，否则 core 推送的 mux.output 会被丢弃（RPC 响应晚于首帧通知）
    const pendingSession: MuxSessionRecord = {
      id,
      name: spawn.name,
      shell: spawn.shellType,
      cwd: spawn.cwd,
      paneCount,
    }
    this.sessions.set(id, pendingSession)

    terminalLog.info('Mux RPC spawnSession', {
      id,
      cols,
      rows,
      shell: spawn.shell,
      requestedShell: options.shell,
      paneCount,
      args: spawn.args,
      envKeys: Object.keys(spawn.env),
    })

    try {
      await this.requestSpawnSession(id, cols, rows, spawn, paneCount)
    } catch (err) {
      this.sessions.delete(id)
      const message = err instanceof Error ? err.message : String(err)
      if (/PTY spawn timed out|spawn shell in pty/i.test(message)) {
        terminalLog.warn('Mux spawnSession timed out, restarting daemon and retrying once', {
          id,
          shell: spawn.shell,
        })
        await this.restartDaemon()
        await this.requestSpawnSession(id, cols, rows, spawn, paneCount)
      } else {
        terminalLog.error('Mux spawnSession failed', logErrorPayload(err))
        throw err
      }
    }

    const session = pendingSession
    terminalLog.info('Mux session created', { id, paneCount, shell: spawn.shellType })
    return {
      id,
      name: spawn.name,
      shell: spawn.shellType,
      cwd: spawn.cwd,
      paneCount,
    }
  }

  private async requestSpawnSession(
    id: string,
    cols: number,
    rows: number,
    spawn: Awaited<ReturnType<typeof resolveMuxSpawnParams>>,
    paneCount: 1 | 2 | 4,
  ): Promise<void> {
    await this.rpc!.request('mux.spawnSession', {
      sessionId: id,
      cols,
      rows,
      shell: spawn.shell,
      args: spawn.args,
      env: spawn.env,
      cwd: spawn.cwd,
      paneCount,
    })
  }

  private async restartDaemon(): Promise<void> {
    killMuxDaemon({ force: true })
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.rpc?.close()
    this.rpc = null
    this.ready = false
    this.starting = null
    await new Promise((resolve) => setTimeout(resolve, 400))
    await ensureMuxDaemon({ mode: resolveMuxCoreRunMode() })
    this.rpc = new MuxRpcClient()
    this.setupRpcHandlers(this.rpc)
    await this.rpc.connect()
    this.ready = true
  }

  write(id: string, data: string, paneIndex?: number): void {
    if (!this.sessions.has(id) || !data || !this.rpc) return
    if (!this.inputLoggedSessions.has(id)) {
      this.inputLoggedSessions.add(id)
      terminalLog.info('Mux first input', {
        id,
        bytes: data.length,
        paneIndex: paneIndex ?? 0,
        preview: data.slice(0, 8).replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
      })
    }
    void this.rpc
      .request('mux.writeInput', {
        sessionId: id,
        paneIndex,
        dataB64: Buffer.from(data, 'utf8').toString('base64'),
      })
      .catch((err) => terminalLog.warn('Mux writeInput failed', logErrorPayload(err)))
  }

  resize(id: string, cols: number, rows: number): void {
    if (!this.sessions.has(id) || !this.rpc) return
    void this.rpc
      .request('mux.resize', { sessionId: id, cols, rows })
      .catch((err) => terminalLog.warn('Mux resize failed', logErrorPayload(err)))
  }

  setFocus(id: string, paneIndex: number): void {
    if (!this.sessions.has(id) || !this.rpc) return
    void this.rpc
      .request('mux.setFocus', { sessionId: id, paneIndex })
      .catch((err) => terminalLog.warn('Mux setFocus failed', logErrorPayload(err)))
  }

  kill(id: string): void {
    if (!this.sessions.has(id)) return
    void this.rpc?.request('mux.killSession', { sessionId: id }).catch(() => {})
    this.disposeSession(id, 0)
  }

  isAlive(id: string): boolean {
    return this.sessions.has(id)
  }

  setActiveStreams(ids: string[]): void {
    const next = new Set(ids.filter((id) => this.sessions.has(id)))
    for (const id of [...this.activeStreamIds]) {
      if (!next.has(id)) {
        this.activeStreamIds.delete(id)
      }
    }
    for (const id of next) {
      if (!this.claimedStreamIds.has(id) || this.activeStreamIds.has(id)) continue
      this.activeStreamIds.add(id)
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
    this.pausedOutput.delete(id)
    const replay =
      pausedBefore.length > 0 ? pausedBefore : (this.latestOutput.get(id) ?? '')
    if (!this.activeStreamIds.has(id)) {
      this.activeStreamIds.add(id)
    }
    terminalLog.info('Mux claimStream', {
      id,
      replayBytes: replay.length,
      pausedBytes: pausedBefore.length,
      newlyClaimed,
      reClaim: !newlyClaimed,
    })
    return replay
  }

  private flushPausedToActive(id: string): void {
    const buffered = this.pausedOutput.get(id)
    if (!buffered) return
    this.pausedOutput.delete(id)
    this.pushOutput(id, buffered)
  }

  dispose(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id)
    }
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.rpc?.close()
    this.rpc = null
    this.ready = false
    this.starting = null
    killMuxDaemon()
  }

  private async ensureConnected(): Promise<void> {
    if (this.rpc?.isConnected() && this.ready) return
    if (this.starting) return this.starting

    this.starting = (async () => {
      await ensureMuxDaemon({ mode: resolveMuxCoreRunMode() })
      if (!this.rpc) {
        this.rpc = new MuxRpcClient()
        this.setupRpcHandlers(this.rpc)
      }
      await this.rpc.connect()
      this.ready = true
      this.starting = null
      terminalLog.info('Mux core ready (TCP JSON-RPC)')
    })()

    try {
      await this.starting
    } catch (err) {
      this.starting = null
      this.ready = false
      throw err
    }
  }

  private setupRpcHandlers(rpc: MuxRpcClient): void {
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []

    this.unsubscribers.push(
      rpc.onNotification('mux.output', (params) => {
        const sessionId = String(params.sessionId ?? '')
        const dataB64 = String(params.dataB64 ?? '')
        const seq = Number(params.seq ?? 0)
        if (!sessionId || !dataB64) return
        const text = Buffer.from(dataB64, 'base64').toString('utf8')
        this.recordCoreOutput(sessionId, text.length, seq)
        this.pushOutput(sessionId, text)
      }),
    )

    this.unsubscribers.push(
      rpc.onNotification('mux.cwdChanged', (params) => {
        const sessionId = String(params.sessionId ?? '')
        const paneIndex = Number(params.paneIndex ?? 0)
        const cwd = String(params.cwd ?? '')
        const session = this.sessions.get(sessionId)
        if (session && cwd) {
          session.cwd = cwd
          this.emit('cwd', sessionId, paneIndex, cwd)
        }
      }),
    )

    this.unsubscribers.push(
      rpc.onNotification('mux.sessionExit', (params) => {
        const sessionId = String(params.sessionId ?? '')
        this.disposeSession(sessionId, 0)
      }),
    )

    this.unsubscribers.push(
      rpc.onNotification('mux.paneExit', (params) => {
        const sessionId = String(params.sessionId ?? '')
        const code = Number(params.code ?? 0)
        this.emit('paneExit', sessionId, Number(params.paneIndex ?? 0), code)
      }),
    )
  }

  private pushOutput(id: string, data: string): void {
    if (!this.sessions.has(id)) {
      terminalLog.warn('Mux output dropped (unknown session)', { id, bytes: data.length })
      return
    }
    this.latestOutput.set(id, data)
    if (!this.activeStreamIds.has(id)) {
      const prevLen = (this.pausedOutput.get(id) ?? '').length
      this.pausedOutput.set(id, data)
      if (prevLen === 0) {
        terminalLog.info('Mux output buffered (stream inactive)', { id, bytes: data.length })
      }
      return
    }

    if (!this.ipcEmitLoggedSessions.has(id)) {
      this.ipcEmitLoggedSessions.add(id)
      terminalLog.info('Mux first IPC emit', { sessionId: id, bytes: data.length })
    }
    this.emit('data', id, data)
  }

  private recordCoreOutput(sessionId: string, bytes: number, seq: number): void {
    const first = !this.coreOutputSeen.has(sessionId)
    this.coreOutputSeen.add(sessionId)
    if (first) {
      terminalLog.info('Mux core first output', { sessionId, bytes, seq })
    }
  }

  private disposeSession(id: string, code: number): void {
    if (!this.sessions.has(id)) return
    terminalLog.info('Mux session disposed', { id, code })
    this.sessions.delete(id)
    this.claimedStreamIds.delete(id)
    this.coreOutputSeen.delete(id)
    this.latestOutput.delete(id)
    this.inputLoggedSessions.delete(id)
    this.ipcEmitLoggedSessions.delete(id)
    this.activeStreamIds.delete(id)
    this.pausedOutput.delete(id)
    this.emit('exit', id, code)
  }
}
