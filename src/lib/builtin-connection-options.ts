import {
  DEFAULT_BUILTIN_CONNECTIONS,
  normalizeDefaultTerminal,
  type BuiltinShellType,
} from '../../electron/shared/builtin-shells'
import type { AppSettings, TerminalCreateOptions } from '../../electron/shared/api-types'

export function getDefaultBuiltinShell(settings: AppSettings | null): BuiltinShellType {
  return normalizeDefaultTerminal(settings?.defaultTerminal)
}

export function getBuiltinTerminalOptions(
  shell: BuiltinShellType,
  settings: AppSettings | null,
): Pick<TerminalCreateOptions, 'shell' | 'args' | 'env'> {
  const config = settings?.builtinConnections?.[shell] ?? DEFAULT_BUILTIN_CONNECTIONS[shell]
  return {
    shell,
    args: config.args.length > 0 ? config.args : undefined,
    env: Object.keys(config.env).length > 0 ? config.env : undefined,
  }
}
