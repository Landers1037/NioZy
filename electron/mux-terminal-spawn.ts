import type { ShellType } from './terminal-service'
import type { MuxTerminalCreateOptions } from './shared/mux-terminal-types'
import type { AppSettings } from './shared/api-types'
import { mergeShellIntegrationArgs, getShellIntegrationEnv, prependNiozyBinToPath } from './shell-integration'
import { resolveExecutable } from './resolve-executable'
import { resolveTerminalImageProtocolFromSettings } from './shared/shell-settings'
import { normalizeTerminalEmulator } from './shared/experimental-settings'

const SHELL_MAP: Record<Exclude<ShellType, 'custom' | 'ssh'>, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
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
  const shellSettings = settings.shell
  const appSettings = settings
  const terminalImageProtocol = resolveTerminalImageProtocolFromSettings(
    shellSettings,
    appSettings.experimental,
  )
  const terminalEmulator = normalizeTerminalEmulator(appSettings.experimental.terminalEmulator)
  const integrationEnv = getShellIntegrationEnv(options.shell, {
    ohMyPoshEnabled: shellSettings.ohMyPoshEnabled === true,
    ohMyPoshTheme: shellSettings.ohMyPoshTheme,
    terminalImageProtocol,
    terminalEmulator,
  })
  const env = {
    ...process.env,
    ...integrationEnv,
    ...options.env,
  } as Record<string, string>
  if (integrationEnv.NIOZY_BIN) {
    prependNiozyBinToPath(env, integrationEnv.NIOZY_BIN)
  }

  let file: string
  let args: string[] = options.args ?? []

  if (options.shell === 'custom' && options.command) {
    file = options.command
    args = options.args ?? []
  } else {
    file = SHELL_MAP[options.shell as keyof typeof SHELL_MAP] ?? 'powershell.exe'
    args = mergeShellIntegrationArgs(options.shell, args, {
      ohMyPoshEnabled: shellSettings.ohMyPoshEnabled === true,
      ohMyPoshTheme: shellSettings.ohMyPoshTheme,
      terminalImageProtocol,
      terminalEmulator,
    })
  }

  const spawnFile = resolveExecutable(file, env as NodeJS.ProcessEnv) ?? file
  const baseName =
    options.name ??
    (options.shell === 'custom' ? spawnFile : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))

  return {
    shell: spawnFile,
    args,
    env,
    cwd: initialCwd,
    name: baseName,
    shellType: options.shell,
  }
}
