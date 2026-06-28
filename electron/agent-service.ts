import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import type { BrowserWindow } from 'electron'
import { tmpdir } from 'os'
import { join } from 'path'
import type { WorkspaceService } from './workspace-service'
import { resolveAgentBinaryPath } from './agent-binary-path'
import { sendToRenderer } from './main/window-ipc'
import { mainLog } from './app-log'
import type {
  AgentEvent,
  AgentMessage,
  AgentMode,
  AgentRuntimeConfig,
  AgentRuntimeStatus,
  AgentSessionState,
  AgentStateSnapshot,
} from './shared/agent-types'
import type { ExperimentalSettings } from './shared/experimental-settings'

type RuntimeCommand =
  | { type: 'init'; config: AgentRuntimeConfig; session: AgentSessionState }
  | { type: 'update-config'; config: AgentRuntimeConfig }
  | { type: 'set-dir'; workspaceDir: string; gitBranch: string | null }
  | { type: 'set-model'; model: string }
  | { type: 'set-mode'; mode: AgentMode }
  | { type: 'send-message'; text: string }
  | { type: 'reset' }

function createDefaultSession(model: string): AgentSessionState {
  return {
    sessionId: 'niozy-agent',
    workspaceDir: '',
    gitBranch: null,
    model,
    mode: 'plan',
    messages: [],
  }
}

function cloneSession(session: AgentSessionState): AgentSessionState {
  return {
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  }
}

export class AgentService {
  private runtime: ChildProcessWithoutNullStreams | null = null
  private runtimeStatus: AgentRuntimeStatus = { state: 'idle' }
  private session: AgentSessionState = createDefaultSession('')
  private lastConfig: AgentRuntimeConfig | null = null

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly getMainWindow: () => BrowserWindow | null,
    private readonly getExperimentalSettings: () => ExperimentalSettings,
  ) {}

  getState(): AgentStateSnapshot {
    return {
      runtime: { ...this.runtimeStatus },
      session: cloneSession(this.session),
    }
  }

  async ensureRuntime(config: AgentRuntimeConfig): Promise<AgentStateSnapshot> {
    this.lastConfig = config
    this.session = { ...this.session, model: config.model }
    if (this.runtime) {
      this.sendCommand({ type: 'update-config', config })
      this.broadcastSession()
      return this.getState()
    }

    this.setRuntimeStatus({ state: 'starting' })
    const binaryPath = resolveAgentBinaryPath()
    const runtimeArgs = this.buildRuntimeArgs()
    const child = spawn(binaryPath, runtimeArgs, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.runtime = child

    const readyState = new Promise<AgentStateSnapshot>((resolve) => {
      child.once('spawn', () => {
        mainLog.info('[Agent] runtime spawned', {
          binaryPath,
          args: runtimeArgs,
          pid: child.pid,
        })
        this.setRuntimeStatus({ state: 'ready', pid: child.pid })
        this.sendCommand({ type: 'init', config, session: this.session })
        resolve(this.getState())
      })

      child.once('error', (error) => {
        mainLog.error('[Agent] runtime process error', { message: error.message })
        this.runtime = null
        this.setRuntimeStatus({ state: 'error', lastError: error.message })
        this.emitEvent({ type: 'error', message: error.message, fatal: true })
        resolve(this.getState())
      })
    })

    child.once('exit', (_code, signal) => {
      mainLog.warn('[Agent] runtime exited', { signal: signal ?? null })
      this.runtime = null
      this.setRuntimeStatus({
        state: 'error',
        lastError: `Agent runtime exited${signal ? ` (${signal})` : ''}`,
      })
    })

    createInterface({ input: child.stdout }).on('line', (line) => {
      if (!line.trim()) return
      try {
        this.applyRuntimeEvent(JSON.parse(line) as AgentEvent)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        mainLog.error('[Agent] invalid runtime stdout event', {
          message,
          line,
        })
        this.emitEvent({ type: 'error', message: `Invalid runtime event: ${message}` })
      }
    })

    createInterface({ input: child.stderr }).on('line', (line) => {
      if (!line.trim()) return
      mainLog.info('[Agent][stderr]', { line: line.trim() })
    })

    return readyState
  }

  async updateConfig(config: AgentRuntimeConfig): Promise<AgentStateSnapshot> {
    this.lastConfig = config
    this.session = { ...this.session, model: config.model }
    if (this.runtime) this.sendCommand({ type: 'update-config', config })
    this.broadcastSession()
    return this.getState()
  }

  async setWorkspaceDir(dir: string): Promise<AgentStateSnapshot> {
    const gitBranch = dir ? await this.workspaceService.gitBranch(dir) : null
    this.session = { ...this.session, workspaceDir: dir, gitBranch }
    if (this.runtime) {
      this.sendCommand({ type: 'set-dir', workspaceDir: dir, gitBranch })
    }
    this.broadcastSession()
    return this.getState()
  }

  async setModel(model: string): Promise<AgentStateSnapshot> {
    this.session = { ...this.session, model }
    if (this.runtime) this.sendCommand({ type: 'set-model', model })
    this.broadcastSession()
    return this.getState()
  }

  async setMode(mode: AgentMode): Promise<AgentStateSnapshot> {
    this.session = { ...this.session, mode }
    if (this.runtime) this.sendCommand({ type: 'set-mode', mode })
    this.broadcastSession()
    return this.getState()
  }

  async sendMessage(text: string, config: AgentRuntimeConfig): Promise<AgentStateSnapshot> {
    if (!text.trim()) return this.getState()
    await this.ensureRuntime(config)
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    this.session = {
      ...this.session,
      messages: [...this.session.messages, userMessage],
    }
    this.broadcastSession()
    this.sendCommand({ type: 'send-message', text })
    return this.getState()
  }

  async resetSession(): Promise<AgentStateSnapshot> {
    this.session = {
      ...createDefaultSession(this.session.model),
      model: this.session.model,
      mode: this.session.mode,
      workspaceDir: this.session.workspaceDir,
      gitBranch: this.session.gitBranch,
    }
    if (this.runtime) this.sendCommand({ type: 'reset' })
    this.broadcastSession()
    return this.getState()
  }

  private applyRuntimeEvent(event: AgentEvent): void {
    if (event.type === 'runtime') {
      this.runtimeStatus = { ...event.runtime }
      this.emitEvent(event)
      return
    }
    if (event.type === 'session') {
      this.session = cloneSession(event.session)
      this.emitEvent({ type: 'session', session: cloneSession(this.session) })
      return
    }
    if (event.type === 'message') {
      this.session = {
        ...this.session,
        messages: [...this.session.messages, { ...event.message }],
      }
      this.emitEvent(event)
      return
    }
    if (event.type === 'messageDelta') {
      this.session = {
        ...this.session,
        messages: this.session.messages.map((message) =>
          message.id === event.messageId
            ? { ...message, content: `${message.content}${event.delta}` }
            : message,
        ),
      }
      this.emitEvent(event)
      return
    }
    if (event.type === 'messageDone') {
      this.session = {
        ...this.session,
        messages: this.session.messages.map((message) =>
          message.id === event.messageId ? { ...message, streaming: false } : message,
        ),
      }
      this.emitEvent(event)
      return
    }
    if (event.type === 'error') {
      this.runtimeStatus = { state: 'error', lastError: event.message }
      this.emitEvent({ type: 'runtime', runtime: { ...this.runtimeStatus } })
      this.emitEvent(event)
    }
  }

  private sendCommand(command: RuntimeCommand): void {
    if (!this.runtime) throw new Error('Agent runtime is not running')
    this.runtime.stdin.write(`${JSON.stringify(command)}\n`)
  }

  private setRuntimeStatus(status: AgentRuntimeStatus): void {
    this.runtimeStatus = status
    this.emitEvent({ type: 'runtime', runtime: { ...status } })
  }

  private broadcastSession(): void {
    this.emitEvent({ type: 'session', session: cloneSession(this.session) })
  }

  private emitEvent(event: AgentEvent): void {
    sendToRenderer(this.getMainWindow(), 'agent:event', event)
  }

  private buildRuntimeArgs(): string[] {
    const experimental = this.getExperimentalSettings()
    const args = ['-log-level', experimental.niozyAgentLogLevel]
    if (experimental.niozyAgentLogToFile) {
      const target =
        experimental.niozyAgentLogFile.trim() || join(tmpdir(), 'niozy-agent.log')
      args.push('-log-file', target)
    }
    return args
  }
}
