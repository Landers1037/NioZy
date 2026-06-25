/**
 * Shared JSON-RPC client for niozy-mux-core TCP server.
 */
import { spawn } from 'child_process'
import { createConnection } from 'net'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const MUX_ROOT = join(__dirname, '..')
export const MUX_DEFAULT_HOST = '127.0.0.1'
export const MUX_DEFAULT_PORT = 19527
const BIN_NAME = process.platform === 'win32' ? 'niozy-mux-core.exe' : 'niozy-mux-core'

export function resolveMuxBinary(binaryArg) {
  if (binaryArg && existsSync(binaryArg)) return binaryArg
  for (const profile of ['release', 'debug']) {
    const p = join(MUX_ROOT, 'niozy-mux-core', 'target', profile, BIN_NAME)
    if (existsSync(p)) return p
  }
  return null
}

export function tryConnect(host = MUX_DEFAULT_HOST, port = MUX_DEFAULT_PORT, timeoutMs = 300) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(null)
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}

export async function ensureMuxDaemon({
  binary,
  host = MUX_DEFAULT_HOST,
  port = MUX_DEFAULT_PORT,
  spawnIfMissing = true,
  killStale = false,
}) {
  if (killStale && process.platform === 'win32') {
    try {
      const { spawnSync } = await import('child_process')
      spawnSync('taskkill', ['/F', '/IM', 'niozy-mux-core.exe'], { stdio: 'ignore', windowsHide: true })
      await new Promise((r) => setTimeout(r, 300))
    } catch {
      // ignore
    }
  }

  if (await tryConnect(host, port, 500)) {
    return { spawned: false, host, port }
  }
  if (!spawnIfMissing) {
    throw new Error(`mux core not listening on ${host}:${port}`)
  }
  if (!binary) throw new Error('mux binary not found')
  const env = { ...process.env }
  let child
  if (process.platform === 'win32') {
    const comSpec = env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
    child = spawn(
      comSpec,
      ['/d', '/s', '/c', 'start', '""', '/B', binary, 'serve', '--mode', 'prod', '--bind', host, '--port', String(port)],
      { detached: true, stdio: 'ignore', windowsHide: true, env },
    )
  } else {
    child = spawn(binary, ['serve', '--mode', 'prod', '--bind', host, '--port', String(port)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    })
  }
  child.unref()
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (await tryConnect(host, port, 300)) {
      return { spawned: true, host, port }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`mux core failed to listen on ${host}:${port}`)
}

export class MuxRpcClient {
  constructor(host = MUX_DEFAULT_HOST, port = MUX_DEFAULT_PORT) {
    this.host = host
    this.port = port
    /** @type {import('net').Socket | null} */
    this.socket = null
    this.buffer = ''
    this.nextId = 1
    /** @type {Map<number, { resolve: Function, reject: Function }>} */
    this.pending = new Map()
    /** @type {Map<string, Set<Function>>} */
    this.notificationHandlers = new Map()
    this.readyPromise = null
    this.readyResolve = null
  }

  onNotification(method, handler) {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set())
    }
    this.notificationHandlers.get(method).add(handler)
    return () => this.notificationHandlers.get(method)?.delete(handler)
  }

  async connect() {
    if (this.socket) return
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })
    await new Promise((resolve, reject) => {
      this.socket = createConnection({ host: this.host, port: this.port }, resolve)
      this.socket.on('error', reject)
      this.socket.on('data', (chunk) => this.onData(chunk))
      this.socket.on('close', () => {
        this.socket = null
        for (const [, { reject: rej }] of this.pending) {
          rej(new Error('mux RPC connection closed'))
        }
        this.pending.clear()
      })
    })
    await Promise.race([
      this.readyPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('mux.ready timeout')), 10_000),
      ),
    ])
  }

  onData(chunk) {
    this.buffer += chunk.toString('utf8')
    let idx
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      this.dispatch(msg)
    }
  }

  dispatch(msg) {
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
    if (msg.method) {
      if (msg.method === 'mux.ready' && this.readyResolve) {
        this.readyResolve(msg.params)
        this.readyResolve = null
      }
      const handlers = this.notificationHandlers.get(msg.method)
      if (handlers) {
        for (const h of handlers) h(msg.params ?? {})
      }
    }
  }

  request(method, params = {}) {
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id })
    return new Promise((resolve, reject) => {
      if (!this.socket?.writable) {
        reject(new Error('not connected'))
        return
      }
      this.pending.set(id, { resolve, reject })
      this.socket.write(`${payload}\n`)
    })
  }

  close() {
    this.socket?.destroy()
    this.socket = null
  }
}

export function decodeOutput(params) {
  return Buffer.from(String(params.dataB64 ?? ''), 'base64').toString('utf8')
}

export function newSessionId(prefix = 'session') {
  return `${prefix}-${randomUUID()}`
}
