import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import type { CustomConnection, TerminalCreateOptions } from './shared/api-types'
import { inferSshAuth, resolveSshConnectionPassword } from './ssh-auth'
import { normalizeConnectTimeoutSeconds } from './shared/ssh-settings'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

/** OpenSSH 只能执行原生可执行文件；Windows 上 .mjs 无效，须用 .cmd / .sh */
function sshAskpassScriptName(): string {
  return process.platform === 'win32' ? 'ssh-askpass.cmd' : 'ssh-askpass.sh'
}

export function resolveSshAskpassScriptPath(): string | null {
  const name = sshAskpassScriptName()

  if (app.isPackaged) {
    const unpacked = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'out',
      'main',
      'scripts',
      name,
    )
    if (existsSync(unpacked)) return unpacked
  }

  const candidates = [
    join(MAIN_DIR, 'scripts', name),
    join(app.getAppPath(), 'out/main/scripts', name),
    join(process.cwd(), 'out/main/scripts', name),
    join(process.cwd(), 'electron/scripts', name),
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
  dynamicPasswordSuffix?: string,
  connectTimeoutSeconds?: number,
): TerminalCreateOptions {
  const auth = inferSshAuth(conn)
  const host = resolveText((conn.sshHost ?? conn.command).trim())
  const user = resolveText((conn.sshUser ?? 'user').trim())
  const port = conn.sshPort ?? 22

  const args: string[] = []
  const connectTimeout = normalizeConnectTimeoutSeconds(connectTimeoutSeconds)
  args.push('-o', `ConnectTimeout=${connectTimeout}`)
  if (port !== 22) args.push('-p', String(port))

  const env: Record<string, string> = { ...(options.env ?? {}) }

  if (auth === 'publickey') {
    const keyPath = conn.sshKeyPath?.trim() ? resolveText(conn.sshKeyPath.trim()) : ''
    if (keyPath) {
      args.push('-i', keyPath, '-o', 'IdentitiesOnly=yes')
    }
    args.push('-o', 'PreferredAuthentications=publickey', '-o', 'PasswordAuthentication=no')
  } else {
    const password =
      resolveSshConnectionPassword(conn, resolveText, dynamicPasswordSuffix) ?? ''
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
