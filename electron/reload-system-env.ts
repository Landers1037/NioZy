import { execFileSync } from 'child_process'
import { augmentWindowsPath, pathSegmentCount } from './resolve-executable'

export interface ReloadEnvironmentResult {
  ok: boolean
  variableCount: number
  pathSegmentCount: number
  error?: string
}

/** 从系统读取最新用户/机器环境变量并合并到主进程 process.env（不退出应用） */
export function reloadSystemEnvironment(): ReloadEnvironmentResult {
  try {
    const count =
      process.platform === 'win32' ? reloadWindowsEnvironment() : reloadUnixEnvironment()
    augmentWindowsPath()
    return {
      ok: true,
      variableCount: count,
      pathSegmentCount: pathSegmentCount(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      variableCount: 0,
      pathSegmentCount: pathSegmentCount(),
      error: message,
    }
  }
}

function applyEnvBlock(block: Record<string, string>): number {
  let count = 0
  for (const [key, value] of Object.entries(block)) {
    if (!key) continue
    process.env[key] = value
    count++
  }
  return count
}

function reloadWindowsEnvironment(): number {
  const script = [
    '$out = @{}',
    "foreach ($scope in 'Machine','User') {",
    '  [Environment]::GetEnvironmentVariables($scope).GetEnumerator() | ForEach-Object {',
    '    $out[$_.Key] = [string]$_.Value',
    '  }',
    '}',
    '$out | ConvertTo-Json -Compress',
  ].join(' ')

  const json = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', timeout: 20_000, windowsHide: true },
  ).trim()

  if (!json) return 0
  const block = JSON.parse(json) as Record<string, string>
  return applyEnvBlock(block)
}

function reloadUnixEnvironment(): number {
  const shell = process.env.SHELL || '/bin/bash'
  const buf = execFileSync(shell, ['-l', '-c', 'env -0'], {
    encoding: 'buffer',
    timeout: 20_000,
  })
  const block: Record<string, string> = {}
  const text = buf.toString('utf8')
  const parts = text.split('\0').filter(Boolean)
  for (const entry of parts) {
    const eq = entry.indexOf('=')
    if (eq <= 0) continue
    const key = entry.slice(0, eq)
    block[key] = entry.slice(eq + 1)
  }
  return applyEnvBlock(block)
}
