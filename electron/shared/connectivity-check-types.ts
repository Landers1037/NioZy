export type ConnectivityProtocol = 'tcp' | 'udp'

export type TcpCheckMethod = 'socket_connect' | 'icmp_ping' | 'tcp_send'
export type UdpCheckMethod = 'udp_send' | 'icmp_ping' | 'udp_connect'
export type ConnectivityCheckMethod = TcpCheckMethod | UdpCheckMethod

export const TCP_CHECK_METHODS: readonly TcpCheckMethod[] = [
  'socket_connect',
  'icmp_ping',
  'tcp_send',
]

export const UDP_CHECK_METHODS: readonly UdpCheckMethod[] = [
  'udp_send',
  'icmp_ping',
  'udp_connect',
]

export interface ConnectivityCheckRequest {
  protocol: ConnectivityProtocol
  method: ConnectivityCheckMethod
  host: string
  port: number
  timeoutMs?: number
}

export interface ConnectivityCheckResult {
  ok: boolean
  reachable: boolean
  latencyMs?: number
  message: string
  detail?: string
}
