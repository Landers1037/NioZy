import { EventEmitter } from 'events'
import * as pty from 'node-pty'
import { randomUUID } from 'crypto'

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
    }

    const name =
      options.name ??
      (options.shell === 'custom' ? file : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))

    const ptyProcess = pty.spawn(file, args, {
      name: 'xterm-color',
      cols,
      rows,
      cwd: options.cwd ?? process.env.USERPROFILE ?? process.cwd(),
      env: env as NodeJS.ProcessEnv,
      useConpty: true,
    })

    ptyProcess.onData((data) => {
      this.emit('data', id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.emit('exit', id, exitCode)
      this.sessions.delete(id)
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
    if (session) {
      session.pty.kill()
      this.sessions.delete(id)
    }
  }

  disposeAll(): void {
    for (const [, session] of this.sessions) {
      try {
        session.pty.kill()
      } catch {
        /* ignore */
      }
    }
    this.sessions.clear()
  }
}
