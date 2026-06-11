export const MIN_CONNECTION_PORT = 1
export const MAX_CONNECTION_PORT = 65535
export const INVALID_CONNECTION_PORT_PREFIX = 'INVALID_CONNECTION_PORT:'

/** @deprecated 与 {@link INVALID_CONNECTION_PORT_PREFIX} 相同，保留 VNC 兼容 */
export const VNC_INVALID_PORT_PREFIX = INVALID_CONNECTION_PORT_PREFIX

export function formatPortReceived(value: unknown): string {
  if (value === undefined || value === null) return String(value)
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(n)) return String(Math.round(n))
  const text = String(value).trim()
  return text || '?'
}

/** 合法端口返回数字；空值返回 defaultPort；非法返回 null */
export function parseConnectionPort(value: unknown, defaultPort: number): number | null {
  if (value === undefined || value === null || value === '') {
    return defaultPort
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < MIN_CONNECTION_PORT || rounded > MAX_CONNECTION_PORT) return null
  return rounded
}

export function assertValidConnectionPort(value: unknown, defaultPort: number): number {
  const port = parseConnectionPort(value, defaultPort)
  if (port === null) {
    throw new Error(`${INVALID_CONNECTION_PORT_PREFIX}${formatPortReceived(value)}`)
  }
  return port
}

export function parseInvalidConnectionPortMessage(message: string): string | null {
  if (!message.startsWith(INVALID_CONNECTION_PORT_PREFIX)) return null
  return message.slice(INVALID_CONNECTION_PORT_PREFIX.length) || '?'
}
