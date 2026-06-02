import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { Client, type ConnectConfig, type KexAlgorithm } from 'ssh2'
import { resolveEnabledKexAlgorithms } from './shared/ssh-kex-algorithms'
import type { SshConnectionProfile } from './shared/ssh-types'

export const SSH2_CONNECT_TIMEOUT_MS = 20_000

export async function buildSsh2ConnectConfig(
  profile: SshConnectionProfile,
  enabledKex?: string[],
): Promise<ConnectConfig> {
  const config: ConnectConfig = {
    host: profile.host,
    port: profile.port ?? 22,
    username: profile.user,
    readyTimeout: SSH2_CONNECT_TIMEOUT_MS,
    tryKeyboard: Boolean(profile.password),
    algorithms: {
      kex: resolveEnabledKexAlgorithms(enabledKex) as KexAlgorithm[],
    },
  }

  if (profile.password) {
    config.password = profile.password
  }

  const keyPath = profile.keyPath?.trim()
  if (keyPath) {
    if (!existsSync(keyPath)) {
      throw new Error(`私钥文件不存在: ${keyPath}`)
    }
    config.privateKey = await readFile(keyPath, 'utf8')
  }

  if (!config.password && !config.privateKey) {
    throw new Error('未配置 SSH 密码或私钥')
  }

  return config
}

export function attachSsh2KeyboardInteractive(conn: Client, password?: string): void {
  if (!password) return
  conn.on('keyboard-interactive', (_name, _instr, _lang, prompts, finish) => {
    if (prompts.length > 0) {
      finish(prompts.map(() => password))
    } else {
      finish([])
    }
  })
}
