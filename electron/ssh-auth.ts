import type { CustomConnection } from './shared/api-types'

/** 推断 SSH 认证方式（兼容未保存 sshAuth 的旧连接） */
export function inferSshAuth(conn: CustomConnection): 'password' | 'publickey' {
  if (conn.sshAuth === 'password' || conn.sshAuth === 'publickey') {
    return conn.sshAuth
  }
  if (conn.sshKeyPath?.trim()) return 'publickey'
  return 'password'
}

/** 连接是否启用了动态密码（仅密码认证有效） */
export function isSshDynamicPasswordEnabled(conn: CustomConnection): boolean {
  return conn.type === 'ssh' && conn.sshDynamicPassword === true && inferSshAuth(conn) === 'password'
}

/** 解析 SSH 登录密码；动态密码模式下为配置密码与后缀拼接 */
export function resolveSshConnectionPassword(
  conn: CustomConnection,
  resolveText: (text: string) => string,
  dynamicSuffix?: string,
): string | undefined {
  if (inferSshAuth(conn) !== 'password') return undefined
  const base = conn.sshPassword?.trim() ? resolveText(conn.sshPassword.trim()) : ''
  const suffix = dynamicSuffix ?? ''
  const combined = base + suffix
  return combined || undefined
}
