import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import type { ShellType } from './terminal-service'

const MAIN_DIR = fileURLToPath(new URL('.', import.meta.url))

export function getShellIntegrationScriptPath(): string | null {
  const candidates = [
    join(MAIN_DIR, 'scripts/shell-integration.ps1'),
    join(MAIN_DIR, '../electron/scripts/shell-integration.ps1'),
    fileURLToPath(new URL('./scripts/shell-integration.ps1', import.meta.url)),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}

export function getShellIntegrationEnv(shell: ShellType): Record<string, string> {
  if (shell === 'powershell' || shell === 'pwsh') {
    return {
      NIOZY_SHELL_INTEGRATION: '1',
      TERM_PROGRAM: 'NioZy',
    }
  }
  return {}
}

export function mergeShellIntegrationArgs(
  shell: ShellType,
  args: string[],
): string[] {
  if (shell !== 'powershell' && shell !== 'pwsh') return args
  if (args.length > 0) return args
  const scriptPath = getShellIntegrationScriptPath()
  if (!scriptPath) return args

  const escaped = scriptPath.replace(/'/g, "''")
  return ['-NoLogo', '-NoExit', '-Command', `& { . '${escaped}' }`]
}
