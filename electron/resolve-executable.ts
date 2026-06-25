import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const WIN_PATH_KEY = () => (process.env.Path !== undefined ? 'Path' : 'PATH')

function windowsExtraPathDirs(): string[] {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const appData = process.env.APPDATA
  const localAppData = process.env.LOCALAPPDATA

  const candidates = [
    join(systemRoot, 'System32', 'OpenSSH'),
    join(systemRoot, 'System32'),
    join(systemRoot, 'Sysnative', 'OpenSSH'),
    join(programFiles, 'Git', 'usr', 'bin'),
    join(programFiles, 'Git', 'bin'),
    join(programFilesX86, 'Git', 'usr', 'bin'),
    ...(appData ? [join(appData, 'npm')] : []),
    ...(localAppData ? [join(localAppData, 'npm')] : []),
  ]

  return candidates.filter((dir) => existsSync(dir))
}

/** Windows 上 GUI 启动的 Electron 常缺少 OpenSSH / Git / npm 全局等目录，补全主进程 PATH */
export function augmentWindowsPath(): void {
  if (process.platform !== 'win32') return

  const extraDirs = windowsExtraPathDirs()

  const key = WIN_PATH_KEY()
  const current = process.env[key] ?? ''
  const parts = current.split(';').filter(Boolean)
  const seen = new Set(parts.map((p) => p.toLowerCase()))

  const prefix: string[] = []
  for (const dir of extraDirs) {
    const lower = dir.toLowerCase()
    if (!seen.has(lower)) {
      prefix.push(dir)
      seen.add(lower)
    }
  }

  if (prefix.length > 0) {
    process.env[key] = [...prefix, ...parts].join(';')
  }
}

function pathEntries(env?: NodeJS.ProcessEnv): string[] {
  const source = env ?? process.env
  const raw = source.Path ?? source.PATH ?? ''
  return raw.split(process.platform === 'win32' ? ';' : ':').filter(Boolean)
}

/** 当前主进程 PATH 中的目录数量（用于重载环境变量后的反馈） */
export function pathSegmentCount(env?: NodeJS.ProcessEnv): number {
  return pathEntries(env).length
}

function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath)
  } catch {
    return false
  }
}

function parseWhereOutput(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 通过 where.exe（Windows）将命令名解析为可执行文件绝对路径。
 * 多个匹配时取 PATH 优先级最高者（where 输出的首条）。
 */
export function resolveExecutableWhere(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const trimmed = command.trim()
  if (!trimmed) return null

  if (/[\\/]/.test(trimmed) || /\.(exe|cmd|bat|com)$/i.test(trimmed)) {
    return fileExists(trimmed) ? trimmed : null
  }

  if (process.platform !== 'win32') {
    return resolveExecutable(trimmed, env)
  }

  const result = spawnSync('where.exe', [trimmed], {
    encoding: 'utf8',
    windowsHide: true,
    env,
  })
  if (result.status !== 0 || !result.stdout) return null

  for (const candidate of parseWhereOutput(result.stdout)) {
    if (fileExists(candidate)) return candidate
  }
  return null
}

/** 将命令名解析为可执行文件绝对路径（仅当 file 为裸命令名时） */
export function resolveExecutable(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const trimmed = command.trim()
  if (!trimmed) return null

  if (/[\\/]/.test(trimmed) || /\.(exe|cmd|bat|com)$/i.test(trimmed)) {
    return fileExists(trimmed) ? trimmed : null
  }

  const extensions =
    process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['', '']

  for (const dir of pathEntries(env)) {
    for (const ext of extensions) {
      const candidate = join(dir, trimmed + ext)
      if (fileExists(candidate)) return candidate
    }
  }

  if (process.platform === 'win32') {
    const fallbackDirs = windowsExtraPathDirs()

    for (const dir of fallbackDirs) {
      for (const ext of extensions) {
        const candidate = join(dir, trimmed + ext)
        if (fileExists(candidate)) return candidate
      }
    }
  }

  return null
}
