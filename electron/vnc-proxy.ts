import { createServer, type Server as HttpServer } from 'node:http'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'
import { assertValidVncPort } from './shared/vnc-settings'

type ProxyKey = string

type ProxySession = {
  key: ProxyKey
  tabId: string
  host: string
  port: number
  path: string
  httpServer: HttpServer
  wss: WebSocketServer
  sockets: Set<net.Socket>
  clients: Set<WebSocket>
}

export class VncWsProxyManager {
  private sessions = new Map<ProxyKey, ProxySession>()

  async start(input: { tabId: string; host: string; port: number }): Promise<{ wsUrl: string }> {
    const tabId = input.tabId
    const host = input.host.trim()
    if (!tabId) throw new Error('TAB_ID_REQUIRED')
    if (!host) throw new Error('HOST_REQUIRED')
    const port = assertValidVncPort(input.port)

    const key: ProxyKey = tabId
    await this.stop({ tabId })

    const path = `/vnc/${encodeURIComponent(tabId)}`
    const httpServer = createServer()
    const wss = new WebSocketServer({ server: httpServer, path })
    const sockets = new Set<net.Socket>()
    const clients = new Set<WebSocket>()

    wss.on('connection', (ws) => {
      clients.add(ws)

      const tcp = net.createConnection({ host, port })
      sockets.add(tcp)

      const closeBoth = () => {
        try {
          ws.close()
        } catch {
          // ignore
        }
        try {
          tcp.destroy()
        } catch {
          // ignore
        }
      }

      ws.on('message', (data) => {
        if (!tcp.writable) return
        // ws message can be Buffer, ArrayBuffer, etc.
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
        tcp.write(buf)
      })
      ws.on('close', closeBoth)
      ws.on('error', closeBoth)

      tcp.on('data', (chunk) => {
        if (ws.readyState !== ws.OPEN) return
        ws.send(chunk)
      })
      tcp.on('close', () => {
        try {
          ws.close()
        } catch {
          // ignore
        }
      })
      tcp.on('error', () => {
        closeBoth()
      })
    })

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject)
      httpServer.listen(0, '127.0.0.1', () => resolve())
    })

    const address = httpServer.address() as AddressInfo | null
    if (!address) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      throw new Error('PROXY_LISTEN_FAILED')
    }

    const wsUrl = `ws://127.0.0.1:${address.port}${path}`

    const session: ProxySession = {
      key,
      tabId,
      host,
      port,
      path,
      httpServer,
      wss,
      sockets,
      clients,
    }
    this.sessions.set(key, session)
    return { wsUrl }
  }

  async stop(input: { tabId: string }): Promise<void> {
    const key: ProxyKey = input.tabId
    const session = this.sessions.get(key)
    if (!session) return
    this.sessions.delete(key)

    for (const ws of session.clients) {
      try {
        ws.close()
      } catch {
        // ignore
      }
    }
    for (const sock of session.sockets) {
      try {
        sock.destroy()
      } catch {
        // ignore
      }
    }

    await new Promise<void>((resolve) => session.wss.close(() => resolve()))
    await new Promise<void>((resolve) => session.httpServer.close(() => resolve()))
  }

  async disposeAll(): Promise<void> {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    for (const s of sessions) {
      try {
        for (const ws of s.clients) ws.close()
        for (const sock of s.sockets) sock.destroy()
      } catch {
        // ignore
      }
      try {
        await new Promise<void>((resolve) => s.wss.close(() => resolve()))
      } catch {
        // ignore
      }
      try {
        await new Promise<void>((resolve) => s.httpServer.close(() => resolve()))
      } catch {
        // ignore
      }
    }
  }
}

