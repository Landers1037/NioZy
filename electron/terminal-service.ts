import { EventEmitter } from 'events'
import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import { resolveExecutable } from './resolve-executable'

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
}

interface PtySession {
  id: string
  pty: pty.IPty
  shell: ShellType
  name: string
}

const SHELL_MAP: Record<Exclude<ShellType, 'custom' | 'ssh'>, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
}

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, PtySession>()

  create(options: TerminalCreateOptions): { id: string; name: string; shell: ShellType } {
    const id = randomUUID()
    const cols = options.cols ?? 120
    const rows = options.rows ?? 30

    let file: string
    let args: string[] = []
    const env = { ...process.env, ...options.env } as Record<string, string>

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
      args = options.args ?? []
    }

    const name =
      options.name ??
      (options.shell === 'custom' ? file : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))

    const spawnFile = resolveSpawnFile(file, env as NodeJS.ProcessEnv)

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(spawnFile, args, {
        name: 'xterm-color',
        cols,
        rows,
        cwd: options.cwd ?? process.env.USERPROFILE ?? process.cwd(),
        env: env as NodeJS.ProcessEnv,
        useConpty: true,
      })
    } catch (err) {
      throw new Error(formatSpawnError(err, spawnFile, options.shell, name))
    }

    ptyProcess.onData((data) => {
      if (!this.sessions.has(id)) return
      this.emit('data', id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (!this.sessions.has(id)) return
      this.sessions.delete(id)
      this.emit('exit', id, exitCode)
    })

    this.sessions.set(id, { id, pty: ptyProcess, shell: options.shell, name })
    return { id, name, shell: options.shell }
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows)
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    try {
      session.pty.kill()
    } catch {
      /* ignore */
    }
  }

  disposeAll(): void {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
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
