/** 用于 SCP / 远程目录列表的 SSH 连接参数（主进程使用） */
export interface SshConnectionProfile {
  host: string
  user: string
  port: number
  keyPath?: string
  /** 密码登录（已解析保险库引用）；主进程通过 SSH_ASKPASS 使用 */
  password?: string
}

export interface ScpFileEntry {
  name: string
  /** 本地绝对路径或远程绝对路径 */
  path: string
  isDirectory: boolean
  size?: number
}

export interface ScpCheckResult {
  found: boolean
  path?: string
}

export interface ScpListResult {
  ok: boolean
  entries?: ScpFileEntry[]
  /** 列出 ~ 后解析出的绝对路径，供后续刷新使用 */
  resolvedPath?: string
  error?: string
}

export interface ScpListRemoteOptions {
  /** 传输完成后刷新：短暂等待并重试，避免与 scp 连接争用 */
  afterTransfer?: boolean
}

export interface ScpTransferResult {
  ok: boolean
  error?: string
}

export interface ScpTransferProgress {
  direction: 'upload' | 'download'
  fileName: string
  transferred: number
  total: number
}
