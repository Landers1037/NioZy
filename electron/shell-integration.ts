import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import type { ShellType } from './terminal-service'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

const SCRIPT_NAME = 'shell-integration.ps1'

/** 安装包 resources 目录下的脚本（asar 外，PowerShell 可直接 dot-source） */
function getPackagedScriptPath(): string | null {
  const external = join(process.resourcesPath, SCRIPT_NAME)
  if (existsSync(external)) return external

  const unpacked = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'out',
    'main',
    'scripts',
    SCRIPT_NAME,
  )
  if (existsSync(unpacked)) return unpacked

  return null
}

export function getShellIntegrationScriptPath(): string | null {
  if (app.isPackaged) {
    return getPackagedScriptPath()
  }

  const devCandidates = [
    join(MAIN_DIR, 'scripts', SCRIPT_NAME),
    join(process.cwd(), 'out', 'main', 'scripts', SCRIPT_NAME),
    join(process.cwd(), 'electron', 'scripts', SCRIPT_NAME),
  ]
  for (const file of devCandidates) {
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
