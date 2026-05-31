export const DEFAULT_P2P_PORT = 6869
export const MIN_P2P_PORT = 1024
export const MAX_P2P_PORT = 65535

export interface P2pSettings {
  /** 开启 P2P 局域网聊天 */
  enabled: boolean
  /** 监听与连接端口 */
  port: number
  /** 允许被局域网扫描发现；关闭后仍可手动 IP:端口 连接 */
  discoveryEnabled: boolean
}

export const DEFAULT_P2P_SETTINGS: P2pSettings = {
  enabled: false,
  port: DEFAULT_P2P_PORT,
  discoveryEnabled: true,
}

export function normalizeP2pPort(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_P2P_PORT
  return Math.min(MAX_P2P_PORT, Math.max(MIN_P2P_PORT, Math.round(n)))
}

export function normalizeP2pSettings(stored: Partial<P2pSettings> | undefined): P2pSettings {
  return {
    enabled:
      typeof stored?.enabled === 'boolean' ? stored.enabled : DEFAULT_P2P_SETTINGS.enabled,
    port: normalizeP2pPort(stored?.port),
    discoveryEnabled:
      typeof stored?.discoveryEnabled === 'boolean'
        ? stored.discoveryEnabled
        : DEFAULT_P2P_SETTINGS.discoveryEnabled,
  }
}
