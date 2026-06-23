import net from 'node:net'
import dgram from 'node:dgram'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  ConnectivityCheckRequest,
  ConnectivityCheckResult,
} from './shared/connectivity-check-types'

const execFileAsync = promisify(execFile)
const DEFAULT_TIMEOUT_MS = 5000

function validatePort(port: number): string | null {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Port must be between 1 and 65535'
  }
  return null
}

function tcpSocketConnect(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ConnectivityCheckResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (result: ConnectivityCheckResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'Connection timed out',
        detail: `TCP connect to ${host}:${port} timed out after ${timeoutMs}ms`,
      })
    }, timeoutMs)

    socket.once('connect', () => {
      clearTimeout(timer)
      finish({
        ok: true,
        reachable: true,
        latencyMs: Date.now() - start,
        message: 'TCP connection established',
        detail: `Successfully connected to ${host}:${port}`,
      })
    })

    socket.once('error', (err) => {
      clearTimeout(timer)
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'Connection failed',
        detail: err.message,
      })
    })

    socket.connect(port, host)
  })
}

function tcpSendProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ConnectivityCheckResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (result: ConnectivityCheckResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'Probe timed out',
        detail: `TCP probe to ${host}:${port} timed out after ${timeoutMs}ms`,
      })
    }, timeoutMs)

    socket.once('connect', () => {
      socket.write(Buffer.from('NIOZY_PROBE\n'), (err) => {
        clearTimeout(timer)
        if (err) {
          finish({
            ok: true,
            reachable: false,
            latencyMs: Date.now() - start,
            message: 'Probe send failed',
            detail: err.message,
          })
          return
        }
        finish({
          ok: true,
          reachable: true,
          latencyMs: Date.now() - start,
          message: 'TCP probe sent',
          detail: `Connected and sent probe packet to ${host}:${port}`,
        })
      })
    })

    socket.once('error', (err) => {
      clearTimeout(timer)
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'Connection failed',
        detail: err.message,
      })
    })

    socket.connect(port, host)
  })
}

function udpSendProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ConnectivityCheckResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    let settled = false

    const finish = (result: ConnectivityCheckResult) => {
      if (settled) return
      settled = true
      socket.close()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: true,
        reachable: true,
        latencyMs: Date.now() - start,
        message: 'UDP packet sent',
        detail: `UDP probe sent to ${host}:${port} (no ICMP unreachable within ${timeoutMs}ms)`,
      })
    }, timeoutMs)

    socket.once('error', (err) => {
      clearTimeout(timer)
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'UDP send failed',
        detail: err.message,
      })
    })

    socket.send(Buffer.from('NIOZY_PROBE'), port, host, (err) => {
      if (err) {
        clearTimeout(timer)
        finish({
          ok: true,
          reachable: false,
          latencyMs: Date.now() - start,
          message: 'UDP send failed',
          detail: err.message,
        })
      }
    })
  })
}

function udpConnectProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ConnectivityCheckResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    let settled = false

    const finish = (result: ConnectivityCheckResult) => {
      if (settled) return
      settled = true
      socket.close()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: true,
        reachable: true,
        latencyMs: Date.now() - start,
        message: 'UDP endpoint reachable',
        detail: `Connected UDP socket to ${host}:${port} (no ICMP unreachable within ${timeoutMs}ms)`,
      })
    }, timeoutMs)

    socket.once('error', (err) => {
      clearTimeout(timer)
      finish({
        ok: true,
        reachable: false,
        latencyMs: Date.now() - start,
        message: 'UDP endpoint unreachable',
        detail: err.message,
      })
    })

    socket.connect(port, host, () => {
      socket.send(Buffer.from('NIOZY_PROBE'), (err) => {
        if (err) {
          clearTimeout(timer)
          finish({
            ok: true,
            reachable: false,
            latencyMs: Date.now() - start,
            message: 'UDP send failed',
            detail: err.message,
          })
        }
      })
    })
  })
}

async function icmpPing(host: string, timeoutMs: number): Promise<ConnectivityCheckResult> {
  const start = Date.now()
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000))

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync(
        'ping',
        ['-n', '1', '-w', String(timeoutMs), host],
        { timeout: timeoutMs + 2000, windowsHide: true },
      )
      const reachable = /TTL=/i.test(stdout) || /time[=<]/i.test(stdout)
      return {
        ok: true,
        reachable,
        latencyMs: Date.now() - start,
        message: reachable ? 'ICMP reply received' : 'ICMP unreachable',
        detail: stdout.trim().split('\n').slice(-3).join('\n'),
      }
    }

    const waitFlag = process.platform === 'darwin' ? '-W' : '-W'
    const waitValue =
      process.platform === 'darwin' ? String(timeoutSec * 1000) : String(timeoutSec)

    const { stdout } = await execFileAsync(
      'ping',
      ['-c', '1', waitFlag, waitValue, host],
      { timeout: timeoutMs + 2000 },
    )
    const reachable = /time[=<]/i.test(stdout) || /bytes from/i.test(stdout)
    return {
      ok: true,
      reachable,
      latencyMs: Date.now() - start,
      message: reachable ? 'ICMP reply received' : 'ICMP unreachable',
      detail: stdout.trim().split('\n').slice(-3).join('\n'),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: true,
      reachable: false,
      latencyMs: Date.now() - start,
      message: 'ICMP ping failed',
      detail: message,
    }
  }
}

export async function runConnectivityCheck(
  req: ConnectivityCheckRequest,
): Promise<ConnectivityCheckResult> {
  const host = req.host.trim()
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!host) {
    return { ok: false, reachable: false, message: 'Host is required' }
  }

  if (req.method !== 'icmp_ping') {
    const portError = validatePort(req.port)
    if (portError) {
      return { ok: false, reachable: false, message: portError }
    }
  }

  if (req.protocol === 'tcp') {
    switch (req.method) {
      case 'socket_connect':
        return tcpSocketConnect(host, req.port, timeoutMs)
      case 'icmp_ping':
        return icmpPing(host, timeoutMs)
      case 'tcp_send':
        return tcpSendProbe(host, req.port, timeoutMs)
      default:
        return { ok: false, reachable: false, message: 'Unsupported TCP method' }
    }
  }

  switch (req.method) {
    case 'udp_send':
      return udpSendProbe(host, req.port, timeoutMs)
    case 'icmp_ping':
      return icmpPing(host, timeoutMs)
    case 'udp_connect':
      return udpConnectProbe(host, req.port, timeoutMs)
    default:
      return { ok: false, reachable: false, message: 'Unsupported UDP method' }
  }
}
