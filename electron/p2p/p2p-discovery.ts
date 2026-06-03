import { connect } from 'net'
import si from 'systeminformation'
import { p2pLog } from '../app-log'
import { P2P_MAGIC, P2P_VERSION, WireFrameReader, encodeWireFrame, isValidHello } from './p2p-protocol'
import type { P2pPeerInfo } from '../shared/p2p-types'

const PROBE_TIMEOUT_MS = 800
const SCAN_CONCURRENCY = 50

interface NetworkInterfaceInfo {
  internal?: boolean
  ip4?: string
  ip4subnet?: string
}

export type ProbeFailureReason =
  | 'connect_error'
  | 'timeout'
  | 'invalid_hello'
  | 'device_mismatch'
  | 'no_response'
  | 'parse_error'

export interface ProbePeerFailure {
  reason: ProbeFailureReason
  message?: string
  ip: string
  port: number
  expectedDeviceId?: string
  actualDeviceId?: string
}

export interface ProbePeerResult {
  peer: P2pPeerInfo | null
  failure?: ProbePeerFailure
}

/** 将探测失败转为可读说明（用于 UI 与日志） */
export function describeProbeFailure(failure?: ProbePeerFailure): string {
  if (!failure) {
    return 'No response from peer (port closed, filtered, or not a NioZy client)'
  }
  const addr = `${failure.ip}:${failure.port}`
  switch (failure.reason) {
    case 'connect_error':
      return `Cannot connect to ${addr}: ${failure.message ?? 'connection refused or host unreachable'}`
    case 'timeout':
      return `Probe to ${addr} timed out: ${failure.message ?? 'no timely response'}`
    case 'no_response':
      return `No HELLO from ${addr}: ${failure.message ?? 'peer did not respond'}`
    case 'invalid_hello':
      return `Invalid HELLO from ${addr}: ${failure.message ?? 'unexpected protocol response'}`
    case 'device_mismatch':
      return `Device mismatch at ${addr}: expected ${failure.expectedDeviceId ?? '?'}, got ${failure.actualDeviceId ?? 'unknown'}`
    case 'parse_error':
      return `Probe parse error at ${addr}: ${failure.message ?? 'invalid frame'}`
    default:
      return `Probe failed at ${addr}: ${failure.message ?? failure.reason}`
  }
}

interface SubnetTarget {
  ip: string
  prefix: number
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return 0
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIpv4(n: number): string {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`
}

function listLocalSubnets(ifaces: NetworkInterfaceInfo[]): SubnetTarget[] {
  const targets: SubnetTarget[] = []
  for (const iface of ifaces) {
    if (iface.internal || !iface.ip4 || !iface.ip4subnet) continue
    const mask = ipv4ToInt(iface.ip4subnet)
    const ip = ipv4ToInt(iface.ip4)
    if (!mask || !ip) continue
    let prefix = 0
    for (let m = mask; m & 0x80000000; m <<= 1) prefix++
    if (prefix >= 16 && prefix <= 30) {
      targets.push({ ip: iface.ip4, prefix })
    }
  }
  return targets
}

function enumerateHosts(subnet: SubnetTarget): string[] {
  const mask = prefixToMask(subnet.prefix)
  const network = ipv4ToInt(subnet.ip) & mask
  const broadcast = network | (~mask >>> 0)
  const hosts: string[] = []
  for (let addr = network + 1; addr < broadcast; addr++) {
    const ip = intToIpv4(addr)
    if (ip !== subnet.ip) hosts.push(ip)
  }
  return hosts
}

function prefixToMask(prefix: number): number {
  if (prefix <= 0) return 0
  if (prefix >= 32) return 0xffffffff
  return (0xffffffff << (32 - prefix)) >>> 0
}

export function probePeer(
  ip: string,
  port: number,
  timeoutMs = PROBE_TIMEOUT_MS,
  expectedDeviceId?: string,
): Promise<ProbePeerResult> {
  return new Promise((resolve) => {
    const socket = connect({ host: ip, port, timeout: timeoutMs })
    const reader = new WireFrameReader()
    let settled = false
    let failure: ProbePeerFailure | undefined

    const setFailure = (
      reason: ProbeFailureReason,
      message?: string,
      extra?: Pick<ProbePeerFailure, 'expectedDeviceId' | 'actualDeviceId'>,
    ): void => {
      failure = { reason, message, ip, port, ...extra }
    }

    const finish = (peer: P2pPeerInfo | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (peer) {
        p2pLog.debug('Probe succeeded', { ip, port, deviceId: peer.deviceId })
        resolve({ peer })
        return
      }
      if (!failure) {
        setFailure('no_response', 'Connection closed before valid HELLO')
      }
      p2pLog.debug('Probe failed', failure)
      resolve({ peer: null, failure })
    }

    socket.on('connect', () => {
      p2pLog.debug('Probe TCP connected', { ip, port, expectedDeviceId })
      socket.write(
        encodeWireFrame({
          type: 'HELLO',
          magic: P2P_MAGIC,
          version: P2P_VERSION,
          probe: true,
        }),
      )
    })

    socket.on('data', (chunk) => {
      try {
        reader.feed(chunk, (frame) => {
          if (!isValidHello(frame) || frame.probe) {
            setFailure('invalid_hello', 'Response was not a valid non-probe HELLO')
            finish(null)
            return
          }
          if (typeof frame.deviceId !== 'string' || typeof frame.publicKey !== 'string') {
            setFailure('invalid_hello', 'HELLO missing deviceId or publicKey')
            finish(null)
            return
          }
          if (expectedDeviceId && frame.deviceId !== expectedDeviceId) {
            setFailure('device_mismatch', undefined, {
              expectedDeviceId,
              actualDeviceId: frame.deviceId,
            })
            finish(null)
            return
          }
          finish({
            deviceId: frame.deviceId,
            hostname: typeof frame.hostname === 'string' ? frame.hostname : ip,
            displayName:
              typeof frame.displayName === 'string'
                ? frame.displayName
                : typeof frame.hostname === 'string'
                  ? frame.hostname
                  : ip,
            ip,
            port,
            lastSeen: new Date().toISOString(),
          })
        })
      } catch (err) {
        setFailure('parse_error', err instanceof Error ? err.message : 'Parse error')
        finish(null)
      }
    })

    socket.on('error', (err) => {
      setFailure('connect_error', err.message)
      finish(null)
    })
    socket.on('timeout', () => {
      setFailure('timeout', `Socket timeout after ${timeoutMs}ms`)
      finish(null)
    })
    setTimeout(() => {
      if (!settled) {
        setFailure('no_response', `No HELLO within ${timeoutMs + 100}ms`)
        finish(null)
      }
    }, timeoutMs + 100)
  })
}

export async function scanLan(port: number): Promise<P2pPeerInfo[]> {
  const raw = await si.networkInterfaces()
  const ifaces: NetworkInterfaceInfo[] = Array.isArray(raw) ? raw : [raw]
  const subnets = listLocalSubnets(ifaces)
  const ips = new Set<string>()
  for (const subnet of subnets) {
    for (const ip of enumerateHosts(subnet)) ips.add(ip)
  }

  const targets = [...ips]
  const found = new Map<string, P2pPeerInfo>()
  p2pLog.debug('LAN scan started', { port, hostCount: targets.length })

  for (let i = 0; i < targets.length; i += SCAN_CONCURRENCY) {
    const batch = targets.slice(i, i + SCAN_CONCURRENCY)
    const results = await Promise.all(batch.map((ip) => probePeer(ip, port)))
    for (const { peer } of results) {
      if (peer) found.set(peer.deviceId, peer)
    }
  }

  p2pLog.debug('LAN scan finished', { port, found: found.size })
  return [...found.values()]
}
