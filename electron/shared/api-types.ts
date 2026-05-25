import type { AppLocale } from './locale'
export type { AppLocale } from './locale'
export { APP_LOCALES, DEFAULT_LOCALE, normalizeLocale } from './locale'
export {
  SIDEBAR_COLLAPSED_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  normalizeSidebarWidth,
  clampSidebarWidth,
} from './sidebar-width'
export type ThemeMode = 'light' | 'dark'
export type LayoutMode = 'default' | 'focus' | 'minimal'
export type { UiStyle } from './ui-style'
export {
  UI_STYLE_VALUES,
  normalizeUiStyle,
  uiStyleToDataAttribute,
  getWindowBackgroundColor,
} from './ui-style'
export type TerminalRenderer = 'dom' | 'webgl' | 'webgpu'
import type { TerminalCursorStyle } from './terminal-cursor'
export type { TerminalCursorStyle } from './terminal-cursor'
export { normalizeTerminalCursorStyle } from './terminal-cursor'
import type { TerminalColorScheme } from './terminal-color-schemes'
import type { AppShortcuts } from './shortcuts'
export type { AppShortcuts } from './shortcuts'
export { DEFAULT_SHORTCUTS, APP_SHORTCUT_LABELS } from './shortcuts'
export type { SshSettings } from './ssh-settings'
export { DEFAULT_SSH_SETTINGS, normalizeSshSettings } from './ssh-settings'
export type { ShellSettings } from './shell-settings'
export { DEFAULT_SHELL_SETTINGS, normalizeShellSettings } from './shell-settings'
export type {
  FilesystemSettings,
  FilesystemCustomOpener,
} from './filesystem-settings'
export {
  DEFAULT_FILESYSTEM_SETTINGS,
  normalizeFilesystemSettings,
} from './filesystem-settings'
export type {
  SshConnectionProfile,
  ScpFileEntry,
  ScpCheckResult,
  ScpListResult,
  ScpTransferResult,
  ScpTransferProgress,
} from './ssh-types'

export type VaultVariableType = 'plain' | 'secret'

export interface VaultVariablePublic {
  id: string
  key: string
  type: VaultVariableType
  value?: string
}

export type { TerminalColorScheme } from './terminal-color-schemes'
export {
  TERMINAL_COLOR_SCHEME_IDS,
  normalizeTerminalColorScheme,
} from './terminal-color-schemes'
export type ShellType = 'powershell' | 'cmd' | 'pwsh' | 'custom' | 'ssh'
export type {
  BuiltinShellType,
  BuiltinShellConfig,
  BuiltinConnections,
} from './builtin-shells'
export {
  BUILTIN_SHELL_TYPES,
  BUILTIN_SHELL_EXECUTABLE,
  BUILTIN_SHELL_LABELS,
  DEFAULT_BUILTIN_CONNECTIONS,
  normalizeBuiltinConnections,
  normalizeDefaultTerminal,
} from './builtin-shells'

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
  /** 密码登录；支持 ${vaultKey} 引用存储库 */
  sshPassword?: string
  sshKeyPath?: string
}

export interface AppSettings {
  /** 界面语言 */
  locale: AppLocale
  theme: ThemeMode
  /** minimal：暖中性灰极简；niozy：原版 NioZy 界面 */
  uiStyle: import('./ui-style').UiStyle
  /** default：侧栏展开；focus：侧栏收起；minimal：无侧栏、顶栏下横向图标 Tab */
  layoutMode: LayoutMode
  /** 侧栏展开宽度（px） */
  sidebarWidth: number
  accentColor: string
  fontSize: number
  /** 顶栏是否显示程序名 NioZy（关闭后仅显示图标） */
  showAppTitle: boolean
  /** 弹框打开/关闭过渡动画 */
  enableDialogAnimations: boolean
  terminal: {
    colorScheme: TerminalColorScheme
    fontFamily: string
    fontSize: number
    renderer: TerminalRenderer
    cursorStyle: TerminalCursorStyle
    cursorBlink: boolean
    /** xterm scrollback 行数 */
    scrollback: number
    /** 以亮色显示粗体 */
    drawBoldTextInBrightColors: boolean
    /** 右键：有选区则复制，无选区则粘贴 */
    rightClickCopyPaste: boolean
  }
  connections: CustomConnection[]
  builtinConnections: import('./builtin-shells').BuiltinConnections
  /** 新建终端时使用的内置 Shell；未设置时回退为 PowerShell */
  defaultTerminal: import('./builtin-shells').BuiltinShellType
  system: {
    proxy: string
    launchOnStartup: boolean
    minimizeToTrayOnClose: boolean
  }
  advanced: {
    hardwareAcceleration: boolean
    /** 为 true 时关闭 renderer sandbox */
    disableSandbox: boolean
    transparency: number
    /** 为 false 时主进程停止轮询 CPU/内存并通过 IPC 推送 */
    statusBarLiveStats: boolean
    /** Windows：文件夹 / 目录背景右键「使用 NioZy 打开」 */
    shellContextMenu: boolean
    /** 关闭窗口时记住大小与位置，下次启动恢复 */
    preserveWindowBounds: boolean
    lastWindowState?: import('./window-state').SavedWindowState
    /** 为 true 时将主进程 console 追加写入当前工作目录 NioZy.log */
    debugLog: boolean
  }
  shortcuts: AppShortcuts
  ssh: import('./ssh-settings').SshSettings
  shell: import('./shell-settings').ShellSettings
  filesystem: import('./filesystem-settings').FilesystemSettings
}

export interface ReloadEnvironmentResult {
  ok: boolean
  variableCount: number
  pathSegmentCount: number
  error?: string
}

export interface UpdateCheckResult {
  ok: boolean
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  downloadUrl?: string
  error?: string
}

export interface UpdateDownloadPayload {
  version: string
  downloadUrl: string
}

export interface UpdateDownloadResult {
  ok: boolean
  installerPath?: string
  error?: string
}

export interface SystemStatsData {
  date: string
  time: string
  cpuPercent: number
  memoryPercent: number
  memoryUsedMb: number
  memoryTotalMb: number
}

export interface AppMetricsProcess {
  pid: number
  type: string
  workingSetMb: number
  peakWorkingSetMb: number
  cpuPercent: number
  sandboxed: boolean
}

export interface AppMetricsData {
  totalWorkingSetMb: number
  totalPeakWorkingSetMb: number
  mainHeapUsedMb: number
  mainHeapTotalMb: number
  mainRssMb: number
  processes: AppMetricsProcess[]
  fetchedAt: string
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
  /** Windows：通过 UAC 以管理员权限启动（应用本身无需已提升） */
  elevated?: boolean
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
    getInitial: () => AppSettings | null
    get: () => Promise<AppSettings>
    save: (partial: Partial<AppSettings>) => Promise<AppSettings>
  }
  fonts: {
    list: () => Promise<string[]>
  }
  system: {
    platform: NodeJS.Platform
    getStats: () => Promise<SystemStatsData>
    onStats: (cb: (stats: SystemStatsData) => void) => () => void
    getAppMetrics: () => Promise<AppMetricsData>
    reloadEnvironment: () => Promise<ReloadEnvironmentResult>
    /** Windows：当前进程是否以管理员身份运行 */
    isProcessElevated: () => Promise<boolean>
  }
  app: {
    getVersion: () => Promise<string>
    getPendingOpenDirectory: () => Promise<string | null>
    onOpenDirectory: (cb: (directory: string) => void) => () => void
  }
  terminal: {
    create: (options: TerminalCreateOptions) => Promise<{
      id: string
      name: string
      shell: string
      cwd: string
    }>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
    /** 声明当前向渲染进程推流的终端；非活跃会话输出在主进程有限缓冲 */
    setActiveStream: (id: string | null) => void
    /** 拆分终端：多个 pane 同时推流 */
    setActiveStreams: (ids: string[]) => void
    onData: (cb: (id: string, data: string) => void) => () => void
    onCwd: (cb: (id: string, cwd: string) => void) => () => void
    onExit: (cb: (id: string, code: number) => void) => () => void
  }
  vault: {
    list: () => Promise<VaultVariablePublic[]>
    getKeys: () => Promise<string[]>
    save: (input: {
      id?: string
      key: string
      type: VaultVariableType
      value?: string
    }) => Promise<VaultVariablePublic>
    remove: (id: string) => Promise<void>
    resolve: (text: string) => Promise<string>
  }
  shell: {
    openExternal: (url: string) => void
  }
  update: {
    check: () => Promise<UpdateCheckResult>
    download: (payload: UpdateDownloadPayload) => Promise<UpdateDownloadResult>
  }
  files: {
    /** 弹出保存对话框并写入文本；用户取消时返回 false */
    saveText: (content: string, defaultFileName: string) => Promise<boolean>
    /** 本机文件系统树根（盘符或 /） */
    listRoots: () => Promise<import('./ssh-types').ScpListResult>
    getImagePreviewUrl: (filePath: string) => Promise<import('../fs-service').ImagePreviewResult>
    detectProgram: (options: {
      kind: 'vscode' | 'cursor' | 'custom'
      path?: string
    }) => Promise<import('../fs-service').ProgramDetectResult>
    openWithProgram: (
      programPath: string,
      targetPath: string,
    ) => Promise<import('../fs-service').OpenWithProgramResult>
  }
  ssh: {
    checkScp: () => Promise<import('./ssh-types').ScpCheckResult>
    getProfile: (connectionId: string) => Promise<import('./ssh-types').SshConnectionProfile | null>
    listLocal: (dirPath: string) => Promise<import('./ssh-types').ScpListResult>
    listRemote: (
      connectionId: string,
      remotePath: string,
      options?: import('./ssh-types').ScpListRemoteOptions,
    ) => Promise<import('./ssh-types').ScpListResult>
    upload: (
      connectionId: string,
      localPath: string,
      remotePath: string,
      onProgress?: (progress: import('./ssh-types').ScpTransferProgress) => void,
    ) => Promise<import('./ssh-types').ScpTransferResult>
    download: (
      connectionId: string,
      remotePath: string,
      localPath: string,
      onProgress?: (progress: import('./ssh-types').ScpTransferProgress) => void,
    ) => Promise<import('./ssh-types').ScpTransferResult>
  }
}
