import { connect } from 'net'
import si from 'systeminformation'

interface NetworkInterfaceInfo {
  internal?: boolean
  ip4?: string
  ip4subnet?: string
}
import { P2P_MAGIC, P2P_VERSION, WireFrameReader, encodeWireFrame, isValidHello } from './p2p-protocol'
import type { P2pPeerInfo } from '../shared/p2p-types'

const PROBE_TIMEOUT_MS = 800
const SCAN_CONCURRENCY = 50

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

export function probePeer(ip: string, port: number, timeoutMs = PROBE_TIMEOUT_MS): Promise<P2pPeerInfo | null> {
  return new Promise((resolve) => {
    const socket = connect({ host: ip, port, timeout: timeoutMs })
    const reader = new WireFrameReader()
    let settled = false

    const finish = (result: P2pPeerInfo | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.on('connect', () => {
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
          if (!isValidHello(frame) || frame.probe) return
          if (typeof frame.deviceId !== 'string' || typeof frame.publicKey !== 'string') return
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
      } catch {
        finish(null)
      }
    })

    socket.on('error', () => finish(null))
    socket.on('timeout', () => finish(null))
    setTimeout(() => finish(null), timeoutMs + 100)
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

  for (let i = 0; i < targets.length; i += SCAN_CONCURRENCY) {
    const batch = targets.slice(i, i + SCAN_CONCURRENCY)
    const results = await Promise.all(batch.map((ip) => probePeer(ip, port)))
    for (const peer of results) {
      if (peer) found.set(peer.deviceId, peer)
    }
  }

  return [...found.values()]
}
