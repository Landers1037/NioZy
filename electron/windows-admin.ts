import { execSync } from 'child_process'
import type { ShellType } from './terminal-service'

/** 当前进程是否以管理员身份运行（仅 Windows） */
export function isWindowsProcessElevated(): boolean {
  if (process.platform !== 'win32') return false
  try {
    execSync('net session', { stdio: 'ignore', windowsHide: true })
    return true
  } catch {
    return false
  }
}

/** 是否支持通过 UAC 桥接为本地内置 Shell 启动提升终端 */
export function canSpawnElevatedTerminal(shell: ShellType): boolean {
  return (
    process.platform === 'win32' &&
    (shell === 'powershell' || shell === 'cmd' || shell === 'pwsh')
  )
}
