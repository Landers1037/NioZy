import type { CustomConnection } from '@/stores/app-store'
import type { TerminalCreateOptions } from '../../electron/shared/api-types'

export const TELNET_BRIDGE_SENTINEL = '__NIOZY_TELNET_BRIDGE__'

/** 将 WSL / Telnet 连接转为 PTY 启动参数 */
export function customConnectionToTerminalCreate(
  custom: CustomConnection,
): TerminalCreateOptions | null {
  if (custom.type === 'wsl') {
    const args: string[] = []
    const distro = custom.wslDistro?.trim()
    if (distro) args.push('-d', distro)
    return {
      shell: 'custom',
      name: custom.name,
      command: 'wsl.exe',
      args,
      env: custom.env,
    }
  }

  if (custom.type === 'telnet') {
    const host = (custom.telnetHost ?? custom.command).trim()
    if (!host) return null
    const port = custom.telnetPort ?? 23
    const args = port === 23 ? [host] : [host, String(port)]
    return {
      shell: 'custom',
      name: custom.name,
      command: TELNET_BRIDGE_SENTINEL,
      args,
      env: custom.env,
    }
  }

  return null
}
