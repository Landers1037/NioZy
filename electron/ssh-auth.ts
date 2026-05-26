import type { CustomConnection } from './shared/api-types'

/** 推断 SSH 认证方式（兼容未保存 sshAuth 的旧连接） */
export function inferSshAuth(conn: CustomConnection): 'password' | 'publickey' {
  if (conn.sshAuth === 'password' || conn.sshAuth === 'publickey') {
    return conn.sshAuth
  }
  if (conn.sshKeyPath?.trim()) return 'publickey'
  return 'password'
}
