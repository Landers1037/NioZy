import { existsSync } from 'fs'
import { join } from 'path'

const WIN_PATH_KEY = () => (process.env.Path !== undefined ? 'Path' : 'PATH')

/** Windows 上 GUI 启动的 Electron 常缺少 OpenSSH / Git 等目录，补全主进程 PATH */
export function augmentWindowsPath(): void {
  if (process.platform !== 'win32') return

  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

  const extraDirs = [
    join(systemRoot, 'System32', 'OpenSSH'),
    join(systemRoot, 'System32'),
    join(systemRoot, 'Sysnative', 'OpenSSH'),
    join(programFiles, 'Git', 'usr', 'bin'),
    join(programFiles, 'Git', 'bin'),
    join(programFilesX86, 'Git', 'usr', 'bin'),
  ].filter((dir) => existsSync(dir))

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

function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath)
  } catch {
    return false
  }
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
    const systemRoot = env.SystemRoot ?? process.env.SystemRoot ?? 'C:\\Windows'
    const programFiles = env.ProgramFiles ?? process.env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 =
      env['ProgramFiles(x86)'] ?? process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

    const fallbackDirs = [
      join(systemRoot, 'System32', 'OpenSSH'),
      join(systemRoot, 'System32'),
      join(programFiles, 'Git', 'usr', 'bin'),
      join(programFilesX86, 'Git', 'usr', 'bin'),
    ]

    for (const dir of fallbackDirs) {
      for (const ext of extensions) {
        const candidate = join(dir, trimmed + ext)
        if (fileExists(candidate)) return candidate
      }
    }
  }

  return null
}
