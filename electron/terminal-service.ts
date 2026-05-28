import { EventEmitter } from 'events'
import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import { resolveExecutable } from './resolve-executable'
import { extractCwdFromTerminalData } from './terminal-cwd-parser'
import { getShellIntegrationEnv, mergeShellIntegrationArgs } from './shell-integration'
import { buildElevatedPtySpawn } from './elevated-terminal-spawn'
import { canSpawnElevatedTerminal } from './windows-admin'

export type ShellType = 'powershell' | 'cmd' | 'pwsh' | 'custom' | 'ssh'

export interface TerminalCreateOptions {
  shell: ShellType
  name?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  cols?: number
  rows?: number
  /** Windows：通过 UAC 以管理员权限启动（应用本身无需已提升） */
  elevated?: boolean
}

interface PtySession {
  id: string
  pty: pty.IPty
  shell: ShellType
  name: string
  cwd: string
}

/** 非活跃标签在主进程侧暂存的输出上限（字符数），切换回来时一次性回放 */
const MAX_PAUSED_OUTPUT_CHARS = 512 * 1024

const SHELL_MAP: Record<Exclude<ShellType, 'custom' | 'ssh'>, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
}

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, PtySession>()
  /** 向渲染进程实时推流的终端 id（拆分视图可同时包含多个） */
  private activeStreamIds = new Set<string>()
  private pausedOutput = new Map<string, string>()

  create(options: TerminalCreateOptions): {
    id: string
    name: string
    shell: ShellType
    cwd: string
  } {
    const id = randomUUID()
    const cols = options.cols ?? 120
    const rows = options.rows ?? 30

    let file: string
    let args: string[] = options.args ?? []
    const initialCwd = options.cwd ?? process.env.USERPROFILE ?? process.cwd()
    const env = {
      ...process.env,
      ...getShellIntegrationEnv(options.shell),
      ...options.env,
    } as Record<string, string>

    if (options.shell === 'custom' && options.command) {
      file = options.command
      args = options.args ?? []
    } else if (options.shell === 'ssh' && options.command) {
      file = 'ssh'
      args = options.args ?? [options.command]
    } else if (options.shell === 'ssh') {
      file = 'ssh'
      args = options.args ?? []
    } else {
      file = SHELL_MAP[options.shell as keyof typeof SHELL_MAP] ?? 'powershell.exe'
      if (options.elevated && process.platform === 'win32') {
        if (args.length === 0) {
          if (options.shell === 'powershell' || options.shell === 'pwsh') {
            // Elevated shell runs with redirected I/O so the normal PSHost
            // prompt is lost. Bootstrap a custom prompt that writes directly
            // to stdout via [Console]::Out, then return empty string so the
            // host itself writes nothing extra.
            const bootstrap = [
              '[Console]::OutputEncoding = [Console]::InputEncoding = [System.Text.Encoding]::Default',
              '$OutputEncoding = [Console]::OutputEncoding',
              'function prompt {',
              "  $p = 'PS ' + $executionContext.SessionState.Path.CurrentLocation + '> '",
              '  [Console]::Out.Write($p)',
              "  return ''",
              '}',
            ].join('; ')
            args = ['-NoLogo', '-NoProfile', '-NoExit', '-Command', bootstrap]
          } else if (options.shell === 'cmd') {
            args = ['/K']
          }
        }
      } else {
        args = mergeShellIntegrationArgs(options.shell, args)
      }
    }

    const baseName =
      options.name ??
      (options.shell === 'custom' ? file : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))
    const name = options.elevated ? `${baseName} (Admin)` : baseName

    const spawnFile = resolveSpawnFile(file, env as NodeJS.ProcessEnv)
    let ptyFile = spawnFile
    let ptyArgs = args

    if (
      options.elevated &&
      process.platform === 'win32' &&
      canSpawnElevatedTerminal(options.shell)
    ) {
      const elevated = buildElevatedPtySpawn(spawnFile, args, initialCwd)
      ptyFile = resolveSpawnFile(elevated.file, env as NodeJS.ProcessEnv)
      ptyArgs = elevated.args
    }

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(ptyFile, ptyArgs, {
        name: 'xterm-color',
        cols,
        rows,
        cwd: initialCwd,
        env: env as NodeJS.ProcessEnv,
        useConpty: true,
      })
    } catch (err) {
      throw new Error(formatSpawnError(err, spawnFile, options.shell, name))
    }

    ptyProcess.onData((data) => {
      const session = this.sessions.get(id)
      if (!session) return
      const cwd = extractCwdFromTerminalData(data)
      if (cwd && cwd !== session.cwd) {
        session.cwd = cwd
        this.emit('cwd', id, cwd)
      }
      this.pushOutput(id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (!this.sessions.has(id)) return
      this.sessions.delete(id)
      this.emit('exit', id, exitCode)
    })

    this.sessions.set(id, {
      id,
      pty: ptyProcess,
      shell: options.shell,
      name,
      cwd: initialCwd,
    })
    this.emit('cwd', id, initialCwd)
    return { id, name, shell: options.shell, cwd: initialCwd }
  }

  /** 单终端 Tab：仅一个 id 实时推流，其余缓冲 */
  setActiveStream(id: string | null): void {
    this.activeStreamIds.clear()
    if (id) {
      this.activeStreamIds.add(id)
      this.flushBufferedOutput(id)
    }
  }

  /** 拆分终端：所有可见 pane 同时实时推流 */
  setActiveStreams(ids: string[]): void {
    this.activeStreamIds = new Set(ids)
    for (const id of ids) {
      this.flushBufferedOutput(id)
    }
  }

  private flushBufferedOutput(id: string): void {
    const buffered = this.pausedOutput.get(id)
    if (!buffered) return
    this.pausedOutput.delete(id)
    this.emit('data', id, buffered)
  }

  private pushOutput(id: string, data: string): void {
    if (this.activeStreamIds.has(id)) {
      this.emit('data', id, data)
      return
    }
    const prev = this.pausedOutput.get(id) ?? ''
    let next = prev + data
    if (next.length > MAX_PAUSED_OUTPUT_CHARS) {
      next = next.slice(-MAX_PAUSED_OUTPUT_CHARS)
    }
    this.pausedOutput.set(id, next)
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows)
  }

  getCwd(id: string): string | undefined {
    return this.sessions.get(id)?.cwd
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    this.pausedOutput.delete(id)
    this.activeStreamIds.delete(id)
    try {
      session.pty.kill()
    } catch {
      /* ignore */
    }
  }

  disposeAll(): void {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    this.pausedOutput.clear()
    this.activeStreamIds.clear()
    for (const session of sessions) {
      try {
        session.pty.kill()
      } catch {
        /* ignore */
      }
    }
  }
}

function resolveSpawnFile(file: string, env: NodeJS.ProcessEnv): string {
  const resolved = resolveExecutable(file, env)
  return resolved ?? file
}

function formatSpawnError(
  err: unknown,
  file: string,
  shell: ShellType,
  displayName: string,
): string {
  const detail = err instanceof Error ? err.message : String(err)
  const missing =
    /ENOENT|not found|cannot find|找不到|不存在/i.test(detail) ||
    /spawn .* ENOENT/i.test(detail)

  if (missing) {
    if (shell === 'pwsh') {
      return '未找到 pwsh.exe。请先安装 PowerShell Core，或选择 PowerShell / CMD。'
    }
    if (shell === 'ssh') {
      return '未找到 ssh 命令。请安装 OpenSSH 客户端或 Git for Windows。'
    }
    return `未找到可执行文件「${file}」，无法启动 ${displayName}。`
  }

  return `无法启动 ${displayName}：${detail}`
}
