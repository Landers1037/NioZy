/** 用于 SCP / 远程目录列表的 SSH 连接参数（主进程使用） */
export interface SshConnectionProfile {
  host: string
  user: string
  port: number
  keyPath?: string
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
  error?: string
}

export interface ScpTransferResult {
  ok: boolean
  error?: string
}
