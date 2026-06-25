import { createConnection, type Socket } from 'net'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { getMuxCoreBinaryPath } from './mux-binary-path'
import { MUX_CORE_HOST, MUX_CORE_PORT } from './mux-core-config'
import { augmentWindowsPath } from './resolve-executable'
import { isElectronDev } from './shared/is-dev'
import { terminalLog, logErrorPayload } from './app-log'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type MuxCoreRunMode = 'dev' | 'prod'

interface JsonRpcMessage {
  jsonrpc?: string
  method?: string
  params?: Record<string, unknown>
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

/** Electron 本次会话 spawn 且应随 App 退出的 core PID；外部已运行的实例不在此列 */
let managedDaemonPid: number | null = null
let managedDaemonOwned = false

export class MuxRpcClient {
  private socket: Socket | null = null
  private buffer = ''
  private nextId = 1
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()
  private readonly notificationHandlers = new Map<
    string,
    Set<(params: Record<string, unknown>) => void>
  >()
  private readyResolve: (() => void) | null = null
  private readyPromise: Promise<void> | null = null

  constructor(
    private readonly host = MUX_CORE_HOST,
    private readonly port = MUX_CORE_PORT,
  ) {}

  onNotification(method: string, handler: (params: Record<string, unknown>) => void): () => void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set())
    }
    this.notificationHandlers.get(method)!.add(handler)
    return () => this.notificationHandlers.get(method)?.delete(handler)
  }

  async connect(timeoutMs = 10_000): Promise<void> {
    if (this.socket) return

    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve
    })

    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port }, () => {
        this.socket = socket
        resolve()
      })
      socket.once('error', reject)
      socket.on('data', (chunk) => this.onData(chunk))
      socket.on('close', () => {
        this.socket = null
        for (const [, pending] of this.pending) {
          pending.reject(new Error('mux RPC connection closed'))
        }
        this.pending.clear()
      })
    })

    await Promise.race([
      this.readyPromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('mux.ready timeout')), timeoutMs),
      ),
    ])
  }

  request(method: string, params: Record<string, JsonValue> = {}): Promise<unknown> {
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id })
    return new Promise((resolve, reject) => {
      if (!this.socket?.writable) {
        reject(new Error('mux RPC not connected'))
        return
      }
      this.pending.set(id, { resolve, reject })
      this.socket.write(`${payload}\n`)
    })
  }

  close(): void {
    this.socket?.destroy()
    this.socket = null
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8')
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg: JsonRpcMessage
      try {
        msg = JSON.parse(line) as JsonRpcMessage
      } catch {
        continue
      }
      this.dispatch(msg)
    }
  }

  private dispatch(msg: JsonRpcMessage): void {
    if (msg.id !== undefined && msg.id !== null) {
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if (msg.error) {
        pending.reject(new Error(msg.error.message ?? 'RPC error'))
      } else {
        pending.resolve(msg.result)
      }
      return
    }

    if (!msg.method) return

    if (msg.method === 'mux.ready' && this.readyResolve) {
      this.readyResolve()
      this.readyResolve = null
    }

    const handlers = this.notificationHandlers.get(msg.method)
    if (handlers) {
      const params = (msg.params ?? {}) as Record<string, unknown>
      for (const handler of handlers) handler(params)
    }
  }
}

function tryConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

export function resolveMuxCoreRunMode(): MuxCoreRunMode {
  return isElectronDev() ? 'dev' : 'prod'
}

function buildServeArgs(host: string, port: number, mode: MuxCoreRunMode): string[] {
  return ['serve', '--mode', mode, '--bind', host, '--port', String(port)]
}

function findListeningPid(host: string, port: number): number | null {
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true }).stdout ?? ''
    const portToken =
      host === '127.0.0.1' || host === 'localhost' ? `127.0.0.1:${port}` : `:${port}`
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING') || !line.includes(portToken)) continue
      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (Number.isFinite(pid) && pid > 0) return pid
    }
    return null
  }

  const out =
    spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
    }).stdout ?? ''
  const pid = Number(out.trim().split(/\s+/)[0])
  return Number.isFinite(pid) && pid > 0 ? pid : null
}

function killProcessByPid(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/PID', String(pid)], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch {
    // ignore — process may already be gone
  }
}

function clearManagedDaemon(): void {
  managedDaemonPid = null
  managedDaemonOwned = false
}

function markManagedDaemon(host: string, port: number): void {
  const pid = findListeningPid(host, port)
  if (pid) {
    managedDaemonPid = pid
    managedDaemonOwned = true
    terminalLog.info('Mux daemon managed pid', { pid, port })
  }
}

export interface EnsureMuxDaemonResult {
  spawned: boolean
  daemonProcess: ChildProcess | null
  owned: boolean
}

function buildMuxDaemonEnv(): NodeJS.ProcessEnv {
  augmentWindowsPath()
  return { ...process.env }
}

function spawnMuxDaemonProcess(
  binary: string,
  host: string,
  port: number,
  mode: MuxCoreRunMode,
): ChildProcess {
  const env = buildMuxDaemonEnv()
  const args = buildServeArgs(host, port, mode)

  if (process.platform === 'win32') {
    const comSpec = env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
    if (mode === 'dev') {
      // 可见控制台窗口输出 tracing 日志
      return spawn(comSpec, ['/d', '/s', '/c', 'start', '""', binary, ...args], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env,
      })
    }
    return spawn(comSpec, ['/d', '/s', '/c', 'start', '""', '/B', binary, ...args], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    })
  }

  if (mode === 'dev') {
    return spawn(binary, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false,
      env,
    })
  }

  return spawn(binary, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env,
  })
}

function attachDevLogPipes(child: ChildProcess): void {
  child.stdout?.on('data', (chunk: Buffer) => {
    terminalLog.info('[mux-core]', { stream: 'stdout', line: chunk.toString('utf8').trimEnd() })
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    terminalLog.info('[mux-core]', { stream: 'stderr', line: chunk.toString('utf8').trimEnd() })
  })
}

export async function ensureMuxDaemon(options?: {
  host?: string
  port?: number
  mode?: MuxCoreRunMode
}): Promise<EnsureMuxDaemonResult> {
  const host = options?.host ?? MUX_CORE_HOST
  const port = options?.port ?? MUX_CORE_PORT
  const mode = options?.mode ?? resolveMuxCoreRunMode()

  if (await tryConnect(host, port, 300)) {
    terminalLog.info('Mux daemon already listening', { host, port })
    return { spawned: false, daemonProcess: null, owned: false }
  }

  const binary = getMuxCoreBinaryPath()
  if (!binary) {
    throw new Error(
      '未找到 niozy-mux-core 可执行文件。请在 niozy-mux-core 目录运行 cargo build --release。',
    )
  }

  terminalLog.info('Starting mux daemon', { binary, host, port, mode })
  const child = spawnMuxDaemonProcess(binary, host, port, mode)
  if (mode === 'dev' && process.platform !== 'win32') {
    attachDevLogPipes(child)
  }
  child.unref()

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (await tryConnect(host, port, 300)) {
      markManagedDaemon(host, port)
      terminalLog.info('Mux daemon ready', { host, port, mode, pid: managedDaemonPid })
      return { spawned: true, daemonProcess: child, owned: managedDaemonOwned }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (await tryConnect(host, port, 500)) {
    return { spawned: false, daemonProcess: null, owned: false }
  }

  throw new Error(`mux core failed to listen on ${host}:${port}`)
}

export interface KillMuxDaemonOptions {
  /** 超时重试等场景：强制结束占用端口的进程（即便非本 App spawn） */
  force?: boolean
}

/** 同步结束 mux core；默认仅结束本 App 本次 spawn 的实例 */
export function killMuxDaemon(options?: KillMuxDaemonOptions): void {
  const force = options?.force === true
  const pid =
    managedDaemonOwned && managedDaemonPid != null
      ? managedDaemonPid
      : force
        ? findListeningPid(MUX_CORE_HOST, MUX_CORE_PORT)
        : null

  if (pid == null) {
    clearManagedDaemon()
    return
  }

  terminalLog.info('Stopping mux daemon', { pid, force, owned: managedDaemonOwned })
  killProcessByPid(pid)
  clearManagedDaemon()
}

export function isMuxDaemonOwnedByApp(): boolean {
  return managedDaemonOwned && managedDaemonPid != null
}
