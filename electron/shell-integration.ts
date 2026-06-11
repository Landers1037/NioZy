import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import { getOhMyPoshBundledResources, getOmpBootstrapScriptPath } from './oh-my-posh-resources'
import { normalizeOhMyPoshTheme, type OhMyPoshThemeId } from './shared/oh-my-posh-themes'
import type { ShellType } from './terminal-service'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

const SCRIPT_NAME = 'shell-integration.ps1'

export interface ShellIntegrationOptions {
  ohMyPoshEnabled?: boolean
  ohMyPoshTheme?: OhMyPoshThemeId
}

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

function escapePs1SingleQuotedPath(filePath: string): string {
  return filePath.replace(/'/g, "''")
}

function getOhMyPoshIntegrationResources(options?: ShellIntegrationOptions) {
  const theme = normalizeOhMyPoshTheme(options?.ohMyPoshTheme)
  return getOhMyPoshBundledResources(theme)
}

function shouldInjectOhMyPosh(shell: ShellType, options?: ShellIntegrationOptions): boolean {
  if (!options?.ohMyPoshEnabled) return false
  if (shell !== 'pwsh') return false
  return getOhMyPoshIntegrationResources(options) !== null
}

export function getShellIntegrationEnv(
  shell: ShellType,
  options?: ShellIntegrationOptions,
): Record<string, string> {
  if (shell === 'powershell' || shell === 'pwsh') {
    const env: Record<string, string> = {
      NIOZY_SHELL_INTEGRATION: '1',
      TERM_PROGRAM: 'NioZy',
    }

    if (shouldInjectOhMyPosh(shell, options)) {
      const resources = getOhMyPoshIntegrationResources(options)!
      env.NIOZY_OMP_ENABLED = '1'
      env.NIOZY_OMP_EXE = resources.exe
      env.NIOZY_OMP_CONFIG = resources.config
      env.NIOZY_POSH_GIT_MODULE = resources.poshGitModule
    }

    return env
  }
  return {}
}

export function mergeShellIntegrationArgs(
  shell: ShellType,
  args: string[],
  options?: ShellIntegrationOptions,
): string[] {
  if (shell !== 'powershell' && shell !== 'pwsh') return args
  const scriptPath = getShellIntegrationScriptPath()
  if (!scriptPath) return args

  const lower = args.map((a) => a.toLowerCase())
  if (lower.includes('-command') || lower.includes('-c') || lower.includes('-file')) return args

  const scripts: string[] = []
  if (shouldInjectOhMyPosh(shell, options)) {
    const ompBootstrap = getOmpBootstrapScriptPath()
    if (ompBootstrap) scripts.push(ompBootstrap)
  }
  scripts.push(scriptPath)

  const dotSource = scripts
    .map((file) => `. '${escapePs1SingleQuotedPath(file)}'`)
    .join('; ')

  return [
    ...args,
    '-NoExit',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `& { ${dotSource} }`,
  ]
}
