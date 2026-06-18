import {
  DEFAULT_ENABLED_SSH_KEX_ALGORITHMS,
  normalizeEnabledKexAlgorithms,
  type SshKexAlgorithmId,
} from './ssh-kex-algorithms'

export const SSH_CONNECT_TIMEOUT_MIN_SECONDS = 3
export const SSH_CONNECT_TIMEOUT_MAX_SECONDS = 120
export const DEFAULT_SSH_CONNECT_TIMEOUT_SECONDS = 10

export interface SshSettings {
  /** SSH 连接断开时，对后台（非当前）SSH 终端 Tab 右下角通知 */
  alertOnDisconnect: boolean
  /** 开启后可在 SSH Tab 右键打开 SCP 文件传输面板 */
  scpTransferEnabled: boolean
  /** 内嵌 SSH 终端使用 ssh2 库直连（不 spawn ssh.exe） */
  useBuiltinSsh2: boolean
  /** OpenSSH ConnectTimeout / ssh2 readyTimeout（秒） */
  connectTimeoutSeconds: number
  /** ssh2 启用的密钥交换算法（顺序见 ssh-kex-algorithms.ts） */
  enabledKexAlgorithms: SshKexAlgorithmId[]
}

export const DEFAULT_SSH_SETTINGS: SshSettings = {
  alertOnDisconnect: false,
  scpTransferEnabled: false,
  useBuiltinSsh2: false,
  connectTimeoutSeconds: DEFAULT_SSH_CONNECT_TIMEOUT_SECONDS,
  enabledKexAlgorithms: [...DEFAULT_ENABLED_SSH_KEX_ALGORITHMS],
}

export function normalizeConnectTimeoutSeconds(value: unknown): number {
  const fallback = DEFAULT_SSH_CONNECT_TIMEOUT_SECONDS
  const n =
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(
    SSH_CONNECT_TIMEOUT_MAX_SECONDS,
    Math.max(SSH_CONNECT_TIMEOUT_MIN_SECONDS, n),
  )
}

export function normalizeSshSettings(value: unknown): SshSettings {
  const v = value && typeof value === 'object' ? (value as Partial<SshSettings>) : {}
  return {
    alertOnDisconnect:
      typeof v.alertOnDisconnect === 'boolean'
        ? v.alertOnDisconnect
        : DEFAULT_SSH_SETTINGS.alertOnDisconnect,
    scpTransferEnabled:
      typeof v.scpTransferEnabled === 'boolean'
        ? v.scpTransferEnabled
        : DEFAULT_SSH_SETTINGS.scpTransferEnabled,
    useBuiltinSsh2:
      typeof v.useBuiltinSsh2 === 'boolean' ? v.useBuiltinSsh2 : DEFAULT_SSH_SETTINGS.useBuiltinSsh2,
    connectTimeoutSeconds: normalizeConnectTimeoutSeconds(v.connectTimeoutSeconds),
    enabledKexAlgorithms: normalizeEnabledKexAlgorithms(v.enabledKexAlgorithms),
  }
}
