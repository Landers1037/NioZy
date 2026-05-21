export const BUILTIN_SHELL_TYPES = ['powershell', 'cmd', 'pwsh'] as const
export type BuiltinShellType = (typeof BUILTIN_SHELL_TYPES)[number]

export const BUILTIN_SHELL_EXECUTABLE: Record<BuiltinShellType, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
}

export const BUILTIN_SHELL_LABELS: Record<BuiltinShellType, string> = {
  powershell: 'PowerShell',
  cmd: 'CMD',
  pwsh: 'PowerShell Core (pwsh)',
}

export interface BuiltinShellConfig {
  args: string[]
  env: Record<string, string>
}

export type BuiltinConnections = Record<BuiltinShellType, BuiltinShellConfig>

export const DEFAULT_BUILTIN_CONNECTIONS: BuiltinConnections = {
  powershell: { args: [], env: {} },
  cmd: { args: [], env: {} },
  pwsh: { args: [], env: {} },
}

export function normalizeBuiltinConnections(
  raw?: Partial<BuiltinConnections> | null,
): BuiltinConnections {
  const out = { ...DEFAULT_BUILTIN_CONNECTIONS }
  if (!raw) return out
  for (const shell of BUILTIN_SHELL_TYPES) {
    const c = raw[shell]
    if (!c || typeof c !== 'object') continue
    out[shell] = {
      args: Array.isArray(c.args) ? c.args.filter((a) => typeof a === 'string') : [],
      env:
        c.env && typeof c.env === 'object' && !Array.isArray(c.env)
          ? (c.env as Record<string, string>)
          : {},
    }
  }
  return out
}
