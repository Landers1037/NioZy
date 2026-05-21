export type ThemeMode = 'light' | 'dark'
export type TerminalRenderer = 'dom' | 'webgl' | 'webgpu'
import type { TerminalColorScheme } from './terminal-color-schemes'

export type { TerminalColorScheme } from './terminal-color-schemes'
export {
  TERMINAL_COLOR_SCHEME_IDS,
  normalizeTerminalColorScheme,
} from './terminal-color-schemes'
export type ShellType = 'powershell' | 'cmd' | 'pwsh' | 'custom' | 'ssh'

export interface CustomConnection {
  id: string
  name: string
  type: 'command' | 'ssh'
  command: string
  args: string[]
  env: Record<string, string>
  sshAuth?: 'password' | 'publickey'
  sshUser?: string
  sshHost?: string
  sshPort?: number
  sshKeyPath?: string
}

export interface AppSettings {
  theme: ThemeMode
  accentColor: string
  fontSize: number
  terminal: {
    colorScheme: TerminalColorScheme
    fontFamily: string
    fontSize: number
    renderer: TerminalRenderer
  }
  connections: CustomConnection[]
  system: {
    proxy: string
    launchOnStartup: boolean
    minimizeToTrayOnClose: boolean
  }
  advanced: {
    hardwareAcceleration: boolean
    transparency: number
    /** 为 false 时主进程停止轮询 CPU/内存并通过 IPC 推送 */
    statusBarLiveStats: boolean
  }
}

export interface SystemStatsData {
  date: string
  time: string
  cpuPercent: number
  memoryPercent: number
  memoryUsedMb: number
  memoryTotalMb: number
}

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

export interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximized: (cb: (maximized: boolean) => void) => () => void
  }
  settings: {
    get: () => Promise<AppSettings>
    save: (partial: Partial<AppSettings>) => Promise<AppSettings>
  }
  system: {
    getStats: () => Promise<SystemStatsData>
    onStats: (cb: (stats: SystemStatsData) => void) => () => void
  }
  terminal: {
    create: (options: TerminalCreateOptions) => Promise<{ id: string; name: string; shell: string }>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
    onData: (cb: (id: string, data: string) => void) => () => void
    onExit: (cb: (id: string, code: number) => void) => () => void
  }
}
