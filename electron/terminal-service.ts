import { EventEmitter } from 'events'
import * as pty from 'node-pty'
import { Client, type ClientChannel } from 'ssh2'
import { randomUUID } from 'crypto'
import { appendTerminalOutputCapped } from './shared/terminal-output-limits'
import { TerminalActiveOutputGate } from './terminal-active-output-gate'
import { resolveExecutable } from './resolve-executable'
import { extractCwdFromTerminalData } from './terminal-cwd-parser'
import { getShellIntegrationEnv, mergeShellIntegrationArgs, prependNiozyBinToPath } from './shell-integration'
import { buildElevatedPtySpawn } from './elevated-terminal-spawn'
import { canSpawnElevatedTerminal } from './windows-admin'
import { logErrorPayload, terminalLog } from './app-log'
import { attachSsh2KeyboardInteractive, buildSsh2ConnectConfig } from './ssh2-connect'
import type { SshConnectionProfile } from './shared/ssh-types'

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
  /** 为 pwsh 注入内置 Oh My Posh + posh-git（由主进程根据设置传入） */
  ohMyPoshEnabled?: boolean
  ohMyPoshTheme?: import('./shared/oh-my-posh-themes').OhMyPoshThemeId
  /** 内联图片协议（iip / kitty），注入 NIOZY_IMAGE_PROTOCOL */
  terminalImageProtocol?: import('./shared/shell-settings').TerminalImageProtocol | null
  /** 终端模拟器（xterm / ghostty / wterm），注入 NIOZY_TERMINAL_EMULATOR */
  terminalEmulator?: import('./shared/experimental-settings').TerminalEmulator
}

interface TerminalSession {
  id: string
  shell: ShellType
  name: string
  cwd: string
  pty?: pty.IPty
  ssh2?: {
    client: Client
    stream: ClientChannel
  }
}

export interface Ssh2TerminalCreateOptions {
  profile: SshConnectionProfile
  enabledKex?: string[]
  connectTimeoutSeconds?: number
  name?: string
  cols?: number
  rows?: number
}

/** 非活跃标签在主进程侧暂存的输出上限（字符数），切换回来时一次性回放 */
const MAX_PAUSED_OUTPUT_CHARS = 512 * 1024

type StreamPauseReason = 'inactive' | 'flow'

const SHELL_MAP: Record<Exclude<ShellType, 'custom' | 'ssh'>, string> = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
  pwsh: 'pwsh.exe',
}

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, TerminalSession>()
  /** 向渲染进程实时推流的终端 id（拆分视图可同时包含多个） */
  private activeStreamIds = new Set<string>()
  private pausedOutput = new Map<string, string>()
  /** 已暂停数据源的终端 id（backpressure：远端 yes 会自然阻塞） */
  private pausedStreamIds = new Set<string>()
  /** 活跃推流闸门（闭环反压：未 ack 超限时 pause PTY） */
  private activeGates = new Map<string, TerminalActiveOutputGate>()
  /** PTY/SSH 暂停原因：inactive Tab 与 flow 反压可叠加 */
  private streamPauseReasons = new Map<string, Set<StreamPauseReason>>()

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
    const shellIntegrationOptions = {
      ohMyPoshEnabled: options.ohMyPoshEnabled === true,
      ohMyPoshTheme: options.ohMyPoshTheme,
      terminalImageProtocol: options.terminalImageProtocol ?? null,
      terminalEmulator: options.terminalEmulator,
    }
    const integrationEnv = getShellIntegrationEnv(options.shell, shellIntegrationOptions)
    const env = {
      ...process.env,
      ...integrationEnv,
      ...options.env,
    } as Record<string, string>
    if (integrationEnv.NIOZY_BIN) {
      prependNiozyBinToPath(env, integrationEnv.NIOZY_BIN)
    }

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
        args = mergeShellIntegrationArgs(options.shell, args, shellIntegrationOptions)
      }
    }

    const baseName =
      options.name ??
      (options.shell === 'custom' ? file : options.shell.charAt(0).toUpperCase() + options.shell.slice(1))
    const name = options.elevated ? `${baseName} (Admin)` : baseName

    const spawnFile = resolveSpawnFile(file, env as NodeJS.ProcessEnv)
    terminalLog.debug('Spawning PTY', {
      shell: options.shell,
      file: spawnFile,
      args,
      cwd: initialCwd,
      elevated: options.elevated === true,
    })
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
      terminalLog.error('PTY spawn failed', {
        shell: options.shell,
        file: spawnFile,
        ...logErrorPayload(err),
      })
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
      terminalLog.debug('PTY process exit', { id, exitCode, name })
      this.sessions.delete(id)
      this.activeStreamIds.delete(id)
      this.pausedStreamIds.delete(id)
      this.disposeActiveGate(id)
      this.streamPauseReasons.delete(id)
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

  /** 使用 ssh2 库建立交互式 Shell（不依赖系统 ssh.exe） */
  async createSsh2(options: Ssh2TerminalCreateOptions): Promise<{
    id: string
    name: string
    shell: ShellType
    cwd: string
  }> {
    const id = randomUUID()
    const cols = options.cols ?? 120
    const rows = options.rows ?? 30
    const profile = options.profile
    const displayHost = `${profile.user}@${profile.host}`
    const name = options.name ?? displayHost
    const initialCwd = `ssh://${displayHost}`

    const client = new Client()
    attachSsh2KeyboardInteractive(client, profile.password)

    terminalLog.debug('Opening ssh2 terminal', {
      host: profile.host,
      port: profile.port ?? 22,
      user: profile.user,
      hasPassword: Boolean(profile.password),
      hasKey: Boolean(profile.keyPath),
    })

    const config = await buildSsh2ConnectConfig(
      profile,
      options.enabledKex,
      options.connectTimeoutSeconds,
    )

    return new Promise((resolve, reject) => {
      let settled = false

      const fail = (err: unknown) => {
        if (settled) return
        settled = true
        try {
          client.end()
        } catch {
          /* ignore */
        }
        const detail = err instanceof Error ? err.message : String(err)
        terminalLog.error('ssh2 terminal connect failed', {
          host: profile.host,
          ...logErrorPayload(err),
        })
        reject(new Error(`SSH 连接失败：${detail}`))
      }

      client.on('error', fail)

      client.on('ready', () => {
        client.shell(
          { rows, cols, width: 0, height: 0, term: 'xterm-color' },
          (shellErr, stream) => {
            if (shellErr) {
              fail(shellErr)
              return
            }
            if (settled) {
              stream.close()
              return
            }
            settled = true

            stream.on('data', (data: Buffer | string) => {
              const text = typeof data === 'string' ? data : data.toString('utf8')
              this.pushOutput(id, text)
            })

            stream.stderr?.on('data', (data: Buffer | string) => {
              const text = typeof data === 'string' ? data : data.toString('utf8')
              this.pushOutput(id, text)
            })

            let exited = false
            const finishSession = (reason: string) => {
              if (exited || !this.sessions.has(id)) return
              exited = true
              terminalLog.debug('ssh2 terminal session end', { id, name, reason })
              this.sessions.delete(id)
              this.pausedOutput.delete(id)
              this.activeStreamIds.delete(id)
              this.pausedStreamIds.delete(id)
              this.disposeActiveGate(id)
              this.streamPauseReasons.delete(id)
              this.emit('exit', id, 0)
            }

            stream.on('close', () => finishSession('stream-close'))
            client.on('close', () => finishSession('client-close'))

            this.sessions.set(id, {
              id,
              shell: 'ssh',
              name,
              cwd: initialCwd,
              ssh2: { client, stream },
            })
            this.emit('cwd', id, initialCwd)
            resolve({ id, name, shell: 'ssh', cwd: initialCwd })
          },
        )
      })

      try {
        client.connect(config)
      } catch (err) {
        fail(err)
      }
    })
  }

  /** 渲染层 xterm 处理完一批输出后 ack，驱动主进程恢复 PTY 推流 */
  ackActiveOutput(id: string, length: number): void {
    if (!Number.isFinite(length) || length <= 0) return
    this.activeGates.get(id)?.ack(Math.floor(length))
  }

  /** 单终端 Tab：仅一个 id 实时推流，其余缓冲 */
  setActiveStream(id: string | null): void {
    this.setActiveStreams(id ? [id] : [])
  }

  /** 拆分终端：所有可见 pane 同时实时推流 */
  setActiveStreams(
    ids: string[],
    options?: { deferRendererClaim?: boolean },
  ): void {
    const newActive = new Set(ids)
    for (const id of this.activeStreamIds) {
      if (!newActive.has(id)) this.pauseSessionStream(id)
    }
    for (const id of newActive) {
      if (!this.activeStreamIds.has(id)) this.resumeSessionStream(id)
    }
    this.activeStreamIds = newActive
    if (options?.deferRendererClaim) return
    for (const id of ids) {
      this.flushBufferedOutput(id)
    }
  }

  /**
   * 渲染进程 xterm 已订阅 terminal:data 后调用：合并进活跃推流集、
   * 清除过早激活导致的 flow 反压，并返回主进程侧尚未推送的缓冲。
   */
  claimStream(id: string): string {
    if (!this.sessions.has(id)) {
      const replay = this.pausedOutput.get(id) ?? ''
      this.pausedOutput.delete(id)
      return replay
    }

    this.removeStreamPause(id, 'flow')
    this.disposeActiveGate(id)

    const replay = this.pausedOutput.get(id) ?? ''
    this.pausedOutput.delete(id)

    if (!this.activeStreamIds.has(id)) {
      const newActive = new Set(this.activeStreamIds)
      newActive.add(id)
      for (const activeId of newActive) {
        if (!this.activeStreamIds.has(activeId)) this.resumeSessionStream(activeId)
      }
      this.activeStreamIds = newActive
    }

    return replay
  }

  private pauseSessionStream(id: string): void {
    const reasons = this.streamPauseReasons.get(id)
    if (reasons?.has('inactive')) return
    this.drainActiveGateToPaused(id)
    this.addStreamPause(id, 'inactive')
  }

  private resumeSessionStream(id: string): void {
    this.removeStreamPause(id, 'inactive')
  }

  private drainActiveGateToPaused(id: string): void {
    const gate = this.activeGates.get(id)
    if (!gate) return
    const rest = gate.drain()
    gate.dispose()
    this.activeGates.delete(id)
    if (!rest) return
    const prev = this.pausedOutput.get(id) ?? ''
    this.pausedOutput.set(
      id,
      appendTerminalOutputCapped(prev, rest, MAX_PAUSED_OUTPUT_CHARS),
    )
  }

  private disposeActiveGate(id: string): void {
    const gate = this.activeGates.get(id)
    if (!gate) return
    gate.dispose()
    this.activeGates.delete(id)
  }

  private addStreamPause(id: string, reason: StreamPauseReason): void {
    let reasons = this.streamPauseReasons.get(id)
    if (!reasons) {
      reasons = new Set()
      this.streamPauseReasons.set(id, reasons)
    }
    if (reasons.has(reason)) return
    reasons.add(reason)
    this.pausedStreamIds.add(id)
    this.applyStreamPauseState(id)
  }

  private removeStreamPause(id: string, reason: StreamPauseReason): void {
    const reasons = this.streamPauseReasons.get(id)
    if (!reasons?.has(reason)) return
    reasons.delete(reason)
    if (reasons.size === 0) {
      this.streamPauseReasons.delete(id)
      this.pausedStreamIds.delete(id)
    }
    this.applyStreamPauseState(id)
  }

  private applyStreamPauseState(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    const paused = (this.streamPauseReasons.get(id)?.size ?? 0) > 0
    try {
      if (session.pty) {
        if (paused) session.pty.pause()
        else session.pty.resume()
        return
      }
      if (session.ssh2) {
        if (paused) session.ssh2.stream.pause()
        else session.ssh2.stream.resume()
      }
    } catch {
      /* ignore */
    }
  }

  private flushBufferedOutput(id: string): void {
    const buffered = this.pausedOutput.get(id)
    if (!buffered) return
    this.pausedOutput.delete(id)
    this.pushActiveOutput(id, buffered)
  }

  private pushOutput(id: string, data: string): void {
    if (this.activeStreamIds.has(id)) {
      this.pushActiveOutput(id, data)
      return
    }
    const prev = this.pausedOutput.get(id) ?? ''
    this.pausedOutput.set(
      id,
      appendTerminalOutputCapped(prev, data, MAX_PAUSED_OUTPUT_CHARS),
    )
  }

  private pushActiveOutput(id: string, data: string): void {
    let gate = this.activeGates.get(id)
    if (!gate) {
      gate = new TerminalActiveOutputGate({
        onEmit: (chunk) => this.emit('data', id, chunk),
        onFlowPause: () => this.addStreamPause(id, 'flow'),
        onFlowResume: () => this.removeStreamPause(id, 'flow'),
      })
      this.activeGates.set(id, gate)
    }
    gate.push(data)
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    if (session.pty) {
      session.pty.write(data)
      return
    }
    session.ssh2?.stream.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) return
    if (session.pty) {
      session.pty.resize(cols, rows)
      return
    }
    try {
      session.ssh2?.stream.setWindow(rows, cols, 0, 0)
    } catch {
      /* ignore */
    }
  }

  getCwd(id: string): string | undefined {
    return this.sessions.get(id)?.cwd
  }

  isAlive(id: string): boolean {
    return this.sessions.has(id)
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    this.pausedOutput.delete(id)
    this.activeStreamIds.delete(id)
    this.pausedStreamIds.delete(id)
    this.disposeActiveGate(id)
    this.streamPauseReasons.delete(id)
    if (session.pty) {
      try {
        session.pty.kill()
      } catch {
        /* ignore */
      }
      return
    }
    if (session.ssh2) {
      try {
        session.ssh2.stream.close()
      } catch {
        /* ignore */
      }
      try {
        session.ssh2.client.end()
      } catch {
        /* ignore */
      }
    }
  }

  disposeAll(): void {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    this.pausedOutput.clear()
    this.activeStreamIds.clear()
    this.pausedStreamIds.clear()
    for (const id of [...this.activeGates.keys()]) {
      this.disposeActiveGate(id)
    }
    this.streamPauseReasons.clear()
    for (const session of sessions) {
      if (session.pty) {
        try {
          session.pty.kill()
        } catch {
          /* ignore */
        }
        continue
      }
      if (session.ssh2) {
        try {
          session.ssh2.stream.close()
        } catch {
          /* ignore */
        }
        try {
          session.ssh2.client.end()
        } catch {
          /* ignore */
        }
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
