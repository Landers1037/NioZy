import type { ShellType } from './terminal-service'
import type { MuxTerminalCreateOptions } from './shared/mux-terminal-types'
import type { AppSettings } from './shared/api-types'
import {
  DEFAULT_BUILTIN_CONNECTIONS,
  type BuiltinShellType,
} from './shared/builtin-shells'
import { existsSync } from 'fs'
import { join } from 'path'
import { resolveExecutable } from './resolve-executable'

function resolveMuxShell(file: string, lookupEnv: NodeJS.ProcessEnv): string {
  const resolved = resolveExecutable(file, lookupEnv)
  if (resolved) return resolved

  if (process.platform !== 'win32') return file

  const fallbacks: string[] = []
  if (file.toLowerCase() === 'pwsh.exe') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    fallbacks.push(join(programFiles, 'PowerShell', '7', 'pwsh.exe'))
    if (process.env.LOCALAPPDATA) {
      fallbacks.push(join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'pwsh.exe'))
    }
  }
  if (file.toLowerCase() === 'powershell.exe') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    fallbacks.push(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
  }
  if (file.toLowerCase() === 'cmd.exe') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    fallbacks.push(join(systemRoot, 'System32', 'cmd.exe'))
  }

  for (const candidate of fallbacks) {
    if (existsSync(candidate)) return candidate
  }
  return file
}

const SHELL_MAP: Record<Exclude<ShellType, 'custom' | 'ssh'>, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
}

function isBuiltinShell(shell: ShellType): shell is BuiltinShellType {
  return shell === 'powershell' || shell === 'cmd' || shell === 'pwsh'
}

/** Mux 不走 shell-integration.ps1 / Oh My Posh；无 args 时用与普通终端一致的默认启动参数 */
function resolveMuxShellArgs(shell: ShellType, args: string[]): string[] {
  if (args.length > 0) return args
  switch (shell) {
    case 'cmd':
      return process.platform === 'win32' ? ['/K'] : args
    case 'powershell':
    case 'pwsh':
      return ['-NoLogo', '-NoExit']
    default:
      return args
  }
}

export interface MuxSpawnParams {
  shell: string
  args: string[]
  env: Record<string, string>
  cwd: string
  name: string
  shellType: ShellType
}

export function resolveMuxSpawnParams(
  options: MuxTerminalCreateOptions,
  settings: AppSettings,
): MuxSpawnParams {
  if (options.shell === 'ssh') {
    throw new Error('Mux 模式暂不支持 SSH，请使用普通终端 Tab。')
  }
  if (options.shell === 'custom' && !options.command) {
    throw new Error('自定义命令未指定 executable。')
  }

  const initialCwd = options.cwd ?? process.env.USERPROFILE ?? process.cwd()
  const lookupEnv = { ...process.env, ...options.env } as NodeJS.ProcessEnv
  const muxEnv: Record<string, string> = { ...(options.env ?? {}) }
  delete muxEnv.Path
  delete muxEnv.PATH

  let file: string
  let args: string[]
  let shellType: ShellType

  if (options.shell === 'custom' && options.command) {
    file = options.command
    args = options.args ?? []
    shellType = 'custom'
  } else {
    shellType = options.shell
    file = SHELL_MAP[shellType as keyof typeof SHELL_MAP] ?? 'powershell.exe'

    const builtinConfig = isBuiltinShell(shellType)
      ? (settings?.builtinConnections?.[shellType] ?? DEFAULT_BUILTIN_CONNECTIONS[shellType])
      : DEFAULT_BUILTIN_CONNECTIONS.powershell
    const configuredArgs = options.args ?? builtinConfig.args
    args = resolveMuxShellArgs(shellType, configuredArgs)

    if (isBuiltinShell(shellType)) {
      for (const [key, value] of Object.entries(builtinConfig.env)) {
        if (!(key in muxEnv)) muxEnv[key] = value
      }
    }
  }

  const spawnFile = resolveMuxShell(file, lookupEnv)
  const baseName =
    options.name ??
    (options.shell === 'custom'
      ? spawnFile
      : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))

  return {
    shell: spawnFile,
    args,
    env: muxEnv,
    cwd: initialCwd,
    name: baseName,
    shellType,
  }
}
