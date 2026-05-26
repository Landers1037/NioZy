import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import type { CustomConnection, TerminalCreateOptions } from './shared/api-types'
import { inferSshAuth } from './ssh-auth'

export function resolveSshAskpassScriptPath(): string | null {
  const candidates = [
    fileURLToPath(new URL('./scripts/ssh-askpass.mjs', import.meta.url)),
    join(app.getAppPath(), 'out/main/scripts/ssh-askpass.mjs'),
    join(process.cwd(), 'out/main/scripts/ssh-askpass.mjs'),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}

/** 根据已保存的 SSH 连接配置补全终端 spawn 参数（认证、密钥、免交互密码） */
export function applySshConnectionToTerminalOptions(
  options: TerminalCreateOptions,
  conn: CustomConnection,
  resolveText: (text: string) => string,
): TerminalCreateOptions {
  const auth = inferSshAuth(conn)
  const host = resolveText((conn.sshHost ?? conn.command).trim())
  const user = resolveText((conn.sshUser ?? 'user').trim())
  const port = conn.sshPort ?? 22

  const args: string[] = []
  if (port !== 22) args.push('-p', String(port))

  const env: Record<string, string> = { ...(options.env ?? {}) }

  if (auth === 'publickey') {
    const keyPath = conn.sshKeyPath?.trim() ? resolveText(conn.sshKeyPath.trim()) : ''
    if (keyPath) {
      args.push('-i', keyPath, '-o', 'IdentitiesOnly=yes')
    }
    args.push('-o', 'PreferredAuthentications=publickey', '-o', 'PasswordAuthentication=no')
  } else {
    const password = conn.sshPassword?.trim() ? resolveText(conn.sshPassword.trim()) : ''
    const askpass = resolveSshAskpassScriptPath()
    if (password && askpass) {
      env.SSH_ASKPASS = askpass
      env.SSH_ASKPASS_REQUIRE = 'force'
      env.NIOZY_SSH_PASS = password
    }
  }

  args.push(`${user}@${host}`)

  return {
    ...options,
    shell: 'ssh',
    command: 'ssh',
    args,
    env,
  }
}
