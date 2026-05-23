import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join, normalize } from 'path'
import { resolveExecutable } from './resolve-executable'
import { imageMimeFromPath, isImageFilePath } from './shared/filesystem-image'

const MAX_PREVIEW_BYTES = 20 * 1024 * 1024

/** Windows: 不创建控制台窗口（与 windowsHide 一并使用） */
const CREATE_NO_WINDOW = 0x08000000

export type EditorKind = 'vscode' | 'cursor'

export interface ProgramDetectResult {
  found: boolean
  path?: string
  error?: string
}

export interface ImagePreviewResult {
  ok: boolean
  dataUrl?: string
  error?: string
}

export interface OpenWithProgramResult {
  ok: boolean
  error?: string
}

function localAppData(): string {
  return process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
}

function windowsVsCodePaths(): string[] {
  const base = localAppData()
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 =
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  return [
    join(base, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    join(programFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    join(programFilesX86, 'Microsoft VS Code', 'bin', 'code.cmd'),
  ]
}

function windowsCursorExePaths(): string[] {
  const base = localAppData()
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  return [
    join(base, 'Programs', 'cursor', 'Cursor.exe'),
    join(base, 'Programs', 'Cursor', 'Cursor.exe'),
    join(programFiles, 'cursor', 'Cursor.exe'),
    join(programFiles, 'Cursor', 'Cursor.exe'),
  ]
}

function isWindowsExe(path: string): boolean {
  return /\.exe$/i.test(path)
}

function isShellScriptLauncher(path: string): boolean {
  return /\.(cmd|bat)$/i.test(path)
}

function quoteForCommandLine(segment: string): string {
  return /[\s"]/.test(segment) ? `"${segment.replace(/"/g, '\\"')}"` : segment
}

/** 拼出与 spawn 等价的完整命令行（便于主进程日志排查） */
export function formatOpenCommand(program: string, args: string[]): string {
  return [quoteForCommandLine(program), ...args.map(quoteForCommandLine)].join(' ')
}

/** PowerShell 中调用 .cmd 等脚本需使用调用运算符 & */
export function formatPowerShellOpenCommand(program: string, args: string[]): string {
  return `& ${formatOpenCommand(program, args)}`
}

function isPowerShellExecutable(filePath: string): boolean {
  return /(?:^|[\\/])(?:powershell(?:_ise)?|pwsh)\.exe$/i.test(filePath)
}

function getWindowsCmdPath(): string {
  const comspec = process.env.ComSpec?.trim()
  if (comspec && existsSync(comspec) && !isPowerShellExecutable(comspec)) {
    return comspec
  }
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  return join(systemRoot, 'System32', 'cmd.exe')
}

type WindowsOpenVia = 'cmd' | 'powershell' | 'direct'

interface WindowsOpenPlan {
  executable: string
  spawnArgs: string[]
  commandLine: string
  via: WindowsOpenVia
}

/** code.cmd 同目录旁的 Code.exe，直接 spawn 可避免弹出 cmd 窗口 */
function resolveCodeExeFromCmd(cmdPath: string): string | null {
  const candidates = [
    normalize(join(cmdPath, '..', '..', 'Code.exe')),
    normalize(join(cmdPath, '..', 'Code.exe')),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * .cmd/.bat：优先解析为 Code.exe 直接启动；否则经 cmd /c（无 start，避免多余控制台）。
 */
function buildWindowsOpenPlan(program: string, args: string[]): WindowsOpenPlan {
  const inner = formatOpenCommand(program, args)

  if (isShellScriptLauncher(program)) {
    const codeExe = /\\code\.cmd$/i.test(program) ? resolveCodeExeFromCmd(program) : null
    if (codeExe) {
      return {
        executable: codeExe,
        spawnArgs: args,
        commandLine: formatOpenCommand(codeExe, args),
        via: 'direct',
      }
    }
    const cmdExe = getWindowsCmdPath()
    return {
      executable: cmdExe,
      spawnArgs: ['/d', '/c', program, ...args],
      commandLine: `${quoteForCommandLine(cmdExe)} /d /c ${inner}`,
      via: 'cmd',
    }
  }

  return {
    executable: program,
    spawnArgs: args,
    commandLine: inner,
    via: 'direct',
  }
}

function windowsSpawnOptions(): {
  detached: boolean
  stdio: 'ignore'
  windowsHide: boolean
  shell: false
  env: NodeJS.ProcessEnv
  creationFlags?: number
} {
  return {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
    env: process.env,
    ...(process.platform === 'win32' ? { creationFlags: CREATE_NO_WINDOW } : {}),
  }
}

/** 解析 VS Code / Cursor 或自定义可执行路径 */
export function resolveProgramPath(
  kind: EditorKind | 'custom',
  configuredPath?: string,
): string | null {
  const custom = configuredPath?.trim()
  if (custom && existsSync(custom)) return custom

  if (kind === 'custom') return null

  if (process.platform === 'win32') {
    const fallbacks = kind === 'vscode' ? windowsVsCodePaths() : windowsCursorExePaths()
    for (const candidate of fallbacks) {
      if (existsSync(candidate)) return candidate
    }
  }

  if (kind === 'vscode') {
    const fromPath = resolveExecutable('code')
    if (fromPath) return fromPath
    return null
  }

  const fromPath = resolveExecutable('cursor')
  if (fromPath) {
    if (process.platform === 'win32') {
      if (isWindowsExe(fromPath) && !isShellScriptLauncher(fromPath)) return fromPath
    } else {
      return fromPath
    }
  }

  return null
}

export function detectProgram(
  kind: EditorKind | 'custom',
  configuredPath?: string,
): ProgramDetectResult {
  const path = resolveProgramPath(kind, configuredPath)
  if (path) return { found: true, path }
  if (kind === 'vscode') {
    return { found: false, error: 'VS Code not found in PATH or default install location' }
  }
  if (kind === 'cursor') {
    return { found: false, error: 'Cursor not found in PATH or default install location' }
  }
  const custom = configuredPath?.trim()
  if (!custom) return { found: false, error: 'Path is empty' }
  return { found: false, error: 'Executable not found at the given path' }
}

export async function readImagePreview(filePath: string): Promise<ImagePreviewResult> {
  try {
    if (!isImageFilePath(filePath)) {
      return { ok: false, error: 'Not an image file' }
    }
    const st = await stat(filePath)
    if (!st.isFile()) return { ok: false, error: 'Not a file' }
    if (st.size > MAX_PREVIEW_BYTES) {
      return { ok: false, error: 'Image is too large to preview' }
    }
    const buf = await readFile(filePath)
    const mime = imageMimeFromPath(filePath)
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    return { ok: true, dataUrl }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function openWithProgram(
  programPath: string,
  targetPath: string,
): Promise<OpenWithProgramResult> {
  const exe = programPath.trim()
  if (!exe || !existsSync(exe)) {
    return Promise.resolve({ ok: false, error: 'Program not found' })
  }
  if (!existsSync(targetPath)) {
    return Promise.resolve({ ok: false, error: 'Target path does not exist' })
  }

  const args = [targetPath]
  const innerCommand = formatOpenCommand(exe, args)

  let executable = exe
  let spawnArgs: string[] = args
  let commandLine = innerCommand
  let via: WindowsOpenVia = 'direct'

  if (process.platform === 'win32' && isShellScriptLauncher(exe)) {
    const plan = buildWindowsOpenPlan(exe, args)
    executable = plan.executable
    spawnArgs = plan.spawnArgs
    commandLine = plan.commandLine
    via = plan.via
  }

  const comspec = process.env.ComSpec?.trim()
  const powershellEquivalent =
    process.platform === 'win32' && isShellScriptLauncher(exe)
      ? formatPowerShellOpenCommand(exe, args)
      : undefined

  console.log('[NioZy] openWithProgram:', {
    program: exe,
    args,
    targetPath,
    via,
    executable,
    spawnArgs,
    commandLine,
    comspec: comspec || undefined,
    powershellEquivalent,
  })

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: OpenWithProgramResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    try {
      const child = spawn(executable, spawnArgs, windowsSpawnOptions())

      child.once('spawn', () => {
        child.unref()
        finish({ ok: true })
      })

      child.on('error', (err) => {
        console.error('[NioZy] openWithProgram spawn error:', err.message)
        finish({ ok: false, error: err.message })
      })

      child.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          console.warn('[NioZy] openWithProgram child exit:', { code, signal, commandLine })
        }
      })
    } catch (err) {
      finish({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}
