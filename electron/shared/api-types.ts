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
export type { TerminalRenderer } from './terminal-renderer'
export { normalizeTerminalRenderer, TERMINAL_RENDERER_VALUES } from './terminal-renderer'
import type { TerminalRenderer } from './terminal-renderer'
import type { TerminalCursorStyle } from './terminal-cursor'
export type { TerminalCursorStyle } from './terminal-cursor'
export { normalizeTerminalCursorStyle } from './terminal-cursor'
import type { TerminalColorScheme } from './terminal-color-schemes'
import type { AppShortcuts } from './shortcuts'
export type { AppShortcuts } from './shortcuts'
export { DEFAULT_SHORTCUTS, APP_SHORTCUT_LABELS } from './shortcuts'
export type { SshSettings } from './ssh-settings'
export { DEFAULT_SSH_SETTINGS, normalizeSshSettings } from './ssh-settings'
export {
  SSH_KEX_ALGORITHM_IDS,
  MODERN_SSH_KEX_ALGORITHM_IDS,
  LEGACY_SSH_KEX_ALGORITHM_IDS,
  DEFAULT_ENABLED_SSH_KEX_ALGORITHMS,
  type SshKexAlgorithmId,
} from './ssh-kex-algorithms'
export type { ShellSettings } from './shell-settings'
export { DEFAULT_SHELL_SETTINGS, normalizeShellSettings } from './shell-settings'
export type {
  ResumeTermSession,
  SavedTerminalTab,
  SavedTerminalPane,
} from './resume-term-session'
export { RESUME_TERM_SESSION_VERSION, normalizeResumeTermSession } from './resume-term-session'
export type { CommandReplayItem } from './command-replay'
export type { PerformanceSettings } from './performance-settings'
export {
  DEFAULT_PERFORMANCE_SETTINGS,
  normalizePerformanceSettings,
} from './performance-settings'
export type {
  FilesystemSettings,
  FilesystemCustomOpener,
} from './filesystem-settings'
export {
  DEFAULT_FILESYSTEM_SETTINGS,
  normalizeFilesystemSettings,
} from './filesystem-settings'
export type { DrawingSettings } from './drawing-settings'
export {
  DEFAULT_DRAWING_SETTINGS,
  normalizeDrawingSettings,
} from './drawing-settings'
export type { P2pSettings } from './p2p-settings'
export { DEFAULT_P2P_SETTINGS, normalizeP2pSettings } from './p2p-settings'
export type { AssistiveSettings } from './assistive-settings'
export { DEFAULT_ASSISTIVE_SETTINGS, normalizeAssistiveSettings } from './assistive-settings'
export type { SessionSettings } from './session-settings'
export {
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_CLAUDE_CODE_HISTORY_PATH,
  normalizeSessionSettings,
} from './session-settings'
export type {
  SessionTool,
  ClaudeCodeSessionEntry,
  ProjectSessionGroup,
  ListClaudeCodeSessionsResult,
} from './session-types'
export type { NoteItem } from './note-types'
export type {
  P2pPeerInfo,
  P2pSessionInfo,
  P2pSessionPeer,
  P2pChatMessage,
  P2pIncomingRequest,
  P2pFileProgress,
  P2pStatus,
  P2pResult,
  P2pConnectResult,
  P2pHistoryResult,
} from './p2p-types'
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

export type PuttyProtocol = 'ssh' | 'telnet'

export interface CustomConnection {
  id: string
  name: string
  type: 'command' | 'ssh' | 'rdp' | 'wsl' | 'telnet' | 'putty' | 'vnc'
  command: string
  args: string[]
  env: Record<string, string>
  sshAuth?: 'password' | 'publickey'
  sshUser?: string
  sshHost?: string
  sshPort?: number
  /** 密码登录；支持 ${vaultKey} 引用存储库 */
  sshPassword?: string
  /** 启用后连接时需手动输入动态密码，最终密码为 sshPassword + 动态密码 */
  sshDynamicPassword?: boolean
  sshKeyPath?: string
  /** SSH 连接分组（仅展示与组织用） */
  sshGroup?: string
  /** SSH 连接成功后依次执行的 bash 命令（每行一条；支持 ${vaultKey}） */
  sshStartupScript?: string
  /** RDP 主机（Windows 远程桌面） */
  rdpHost?: string
  rdpPort?: number
  rdpUser?: string
  /** RDP 密码；支持 ${vaultKey} 引用存储库 */
  rdpPassword?: string
  /** WSL 发行版名称（为空则使用默认） */
  wslDistro?: string
  /** Telnet 主机 */
  telnetHost?: string
  telnetPort?: number
  /** PuTTY 主机 */
  puttyHost?: string
  puttyPort?: number
  puttyUser?: string
  /** PuTTY 密码；支持 ${vaultKey} 引用存储库 */
  puttyPassword?: string
  puttyProtocol?: PuttyProtocol

  /** VNC 主机 */
  vncHost?: string
  vncPort?: number
  /** VNC 用户名（取决于服务端 security type，如 VeNCrypt Plain / UnixLogon / MSLogonII） */
  vncUsername?: string
  /** VNC 密码；支持 ${vaultKey} 引用存储库 */
  vncPassword?: string
  /** Windows：在资源管理器文件夹右键注册「通过 NioZy 打开 {名称}」（仅 type=command） */
  shellContextMenu?: boolean
}

export type ExternalLaunchResult = { ok: true } | { ok: false; error: string }

export interface AppOpenDirectoryPayload {
  directory: string
  connectionId?: string
}

/** @deprecated Use ExternalLaunchResult */
export type RdpConnectResult = ExternalLaunchResult

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
  /** UI 常规字重；未设置时使用主题默认 */
  fontWeight?: number
  /** UI 加粗字重；未设置时使用主题默认 */
  fontWeightBold?: number
  /** 顶栏是否显示程序名 NioZy（关闭后仅显示图标） */
  showAppTitle: boolean
  /** 弹框打开/关闭过渡动画 */
  enableDialogAnimations: boolean
  /** 玻璃界面风格下启用 macOS 风格增强毛玻璃透明效果 */
  enableGlassTransparency: boolean
  /** 启用类似 macOS 的平滑字体渲染（需重启；Windows 下配合 DirectWrite / 高 DPI 清单） */
  enableSmoothFonts: boolean
  terminal: {
    colorScheme: TerminalColorScheme
    fontFamily: string
    /** 为 true 时用 builtinFont 覆盖 fontFamily 渲染终端 */
    useBuiltinFont: boolean
    /** 内置 Nerd Font Mono */
    builtinFont: import('./terminal-builtin-fonts').TerminalBuiltinFontId
    fontSize: number
    /** 终端常规字重；未设置时使用终端默认 */
    fontWeight?: number
    /** 终端加粗字重；未设置时使用终端默认 */
    fontWeightBold?: number
    renderer: TerminalRenderer
    cursorStyle: TerminalCursorStyle
    cursorBlink: boolean
    /** xterm scrollback 行数 */
    scrollback: number
    /** 以亮色显示粗体 */
    drawBoldTextInBrightColors: boolean
    /** 右键：有选区则复制，无选区则粘贴（与 advancedRightClickMenu 互斥） */
    rightClickCopyPaste: boolean
    /** 右键展示终端上下文菜单（与 rightClickCopyPaste 互斥） */
    advancedRightClickMenu: boolean
    /** xterm.js 6+ DEC 2026 同步输出（Wterm 不支持） */
    synchronizedOutputEnabled: boolean
    /** 终端背景图扩展名（不含点），对应 background/bg.{ext} */
    backgroundImageExt?: string
    /** 终端背景图不透明度（0–100） */
    backgroundOpacity: number
    /** 终端闲置时的屏幕动画 */
    idleAnimation: import('./terminal-idle-animation').TerminalIdleAnimationSettings
    /** 无 Tab 时的欢迎页 */
    welcomePage: import('./welcome-page-settings').WelcomePageSettings
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
    /** 为 true 时在 Chromium 启用 WebGPU（须同时开启硬件加速） */
    webGpuAcceleration: boolean
    /** 为 true 时关闭 renderer sandbox */
    disableSandbox: boolean
    transparency: number
    /** 为 false 时主进程停止轮询 CPU/内存并通过 IPC 推送 */
    statusBarLiveStats: boolean
    /** 为 true 时在状态栏内存右侧展示电池电量与充电状态 */
    statusBarBattery: boolean
    /** 状态栏系统信息轮询优先级：高 2s / 中 5s / 低 10s */
    statusBarPollPriority: 'high' | 'medium' | 'low'
    /** Windows：文件夹 / 目录背景右键「使用 NioZy 打开」 */
    shellContextMenu: boolean
    /** 关闭窗口时记住大小与位置，下次启动恢复 */
    preserveWindowBounds: boolean
    /** 检测本程序 CPU 占用并在过高时提示性能降级 */
    resourceAutoDegrade: boolean
    lastWindowState?: import('./window-state').SavedWindowState
  }
  logging: import('./logging-settings').LoggingSettings
  shortcuts: AppShortcuts
  ssh: import('./ssh-settings').SshSettings
  shell: import('./shell-settings').ShellSettings
  performance: import('./performance-settings').PerformanceSettings
  filesystem: import('./filesystem-settings').FilesystemSettings
  drawing: import('./drawing-settings').DrawingSettings
  preview: import('./preview-settings').PreviewSettings
  experimental: import('./experimental-settings').ExperimentalSettings
  statistics: import('./usage-statistics-settings').UsageStatisticsSettings
  p2p: import('./p2p-settings').P2pSettings
  reminder: import('./reminder-settings').ReminderSettings
  assistive: import('./assistive-settings').AssistiveSettings
  session: import('./session-settings').SessionSettings
  workspace: import('./workspace-settings').WorkspaceSettings
}

export interface ReloadEnvironmentResult {
  ok: boolean
  variableCount: number
  pathSegmentCount: number
  error?: string
}

export type SettingsFileError = 'INVALID_JSON' | 'INVALID_FORMAT' | 'READ_FAILED'

export interface SettingsFileResult {
  ok: boolean
  canceled?: boolean
  error?: SettingsFileError
  settings?: AppSettings
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

export type {
  UsageStatisticData,
  StatisticCounters,
} from './usage-statistics-data'

export interface SystemStatsData {
  date: string
  time: string
  cpuPercent: number
  memoryPercent: number
  memoryUsedMb: number
  memoryTotalMb: number
  batteryPercent: number
  batteryCharging: boolean
  batteryHasBattery: boolean
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
  /** SSH 连接 id：主进程据此应用认证方式、密钥路径与 SSH_ASKPASS */
  sshConnectionId?: string
  /** 动态密码后缀（仅连接时传入，不持久化） */
  sshDynamicPasswordSuffix?: string
}

export interface SaveImageInput {
  content: string
  encoding: 'utf8' | 'base64'
  defaultFileName: string
  mimeType?: string
}

export interface AppRuntimeVersions {
  electron: string
  chromium: string
}

export interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximized: (cb: (maximized: boolean) => void) => () => void
    /** 窗口正在被拖拽移动时为 true，用于暂停终端渲染以保持 UI 流畅 */
    onMoving: (cb: (moving: boolean) => void) => () => void
    /** 标题栏 drag-region 按下/抬起时通知主进程暂停/恢复终端 IPC */
    setDragging: (moving: boolean) => void
    /** Windows Snap：将窗口贴到当前屏幕指定分屏布局（类似 Win+←/→） */
    snap: (
      layout:
        | 'left'
        | 'right'
        | 'top'
        | 'bottom'
        | 'topLeft'
        | 'topRight'
        | 'bottomLeft'
        | 'bottomRight',
    ) => void
    /** 若窗口当前处于 Snap 分屏尺寸，则恢复到分屏前的 bounds；返回是否已恢复 */
    toggleSnapRestore: () => Promise<boolean>
    /** 拖动透明度滑块时实时预览，不写盘 */
    setTransparencyPreview: (transparency: number) => void
  }
  settings: {
    getInitial: () => AppSettings | null
    get: () => Promise<AppSettings>
    save: (partial: Partial<AppSettings>) => Promise<AppSettings>
    /** 主进程直接修改设置后推送（如托盘/宠物右键关闭） */
    onChanged: (cb: (settings: AppSettings) => void) => () => void
    exportToFile: () => Promise<SettingsFileResult>
    importFromFile: () => Promise<SettingsFileResult>
  }
  copilot: {
    getRuntimeUrl: () => Promise<string | null>
  }
  aiContext: {
    listRules: () => Promise<import('./ai-context-types').AiRuleSummary[]>
    readRule: (id: string) => Promise<string | null>
    saveRule: (input: { id: string; content: string }) => Promise<void>
    deleteRule: (id: string) => Promise<void>
    listSkills: () => Promise<import('./ai-context-types').AiSkillSummary[]>
    getChatContext: () => Promise<import('./ai-context-types').AiChatContextPayload>
    openSkillsDirectory: () => Promise<void>
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
    getRuntimeVersions: () => Promise<AppRuntimeVersions>
    getPendingOpenDirectory: () => Promise<AppOpenDirectoryPayload | null>
    onOpenDirectory: (cb: (payload: AppOpenDirectoryPayload) => void) => () => void
    /** 托盘菜单：新建终端 Tab */
    onNewTerminal: (cb: () => void) => () => void
    /** 托盘菜单：打开设置 Tab */
    onOpenSettings: (cb: () => void) => () => void
    /** 重启应用（保存设置后使终端模拟器等变更生效） */
    relaunch: () => void
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
    isAlive: (id: string) => Promise<boolean>
    /** 声明当前向渲染进程推流的终端；非活跃会话输出在主进程有限缓冲 */
    setActiveStream: (id: string | null) => void
    /** 拆分终端：多个 pane 同时推流 */
    setActiveStreams: (ids: string[]) => void
    /** xterm 订阅 data 后领取推流并取回主进程缓冲 */
    claimStream: (id: string) => Promise<string>
    /** xterm 处理完一批输出后 ack，驱动主进程闭环反压 */
    ackData: (id: string, length: number) => void
    onData: (cb: (id: string, data: string) => void) => () => void
    onCwd: (cb: (id: string, cwd: string) => void) => () => void
    onExit: (cb: (id: string, code: number) => void) => () => void
    pickBackground: () => Promise<import('../terminal-background-service').TerminalBackgroundPickResult>
    clearBackground: () => Promise<import('../terminal-background-service').TerminalBackgroundClearResult>
    getBackgroundUrl: (ext: string) => Promise<
      | { ok: true; url: string }
      | { ok: false; error: string }
    >
  }
  resumeTerm: {
    load: () => Promise<import('./resume-term-session').ResumeTermSession | null>
    save: (session: import('./resume-term-session').ResumeTermSession) => Promise<void>
    clear: () => Promise<void>
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
    resolveBatch: (texts: string[]) => Promise<string[]>
  }
  shell: {
    openExternal: (url: string) => void
  }
  preview: {
    openLink: (
      tabId: string,
      url: string,
      bounds?: { x: number; y: number; width: number; height: number },
    ) => void
    setBounds: (
      tabId: string,
      bounds: { x: number; y: number; width: number; height: number },
    ) => void
    setVisible: (tabId: string, visible: boolean) => void
    close: (tabId: string) => void
    /** Dialog 等 HTML 浮层打开时隐藏链接预览原生视图 */
    setOverlaySuppressed: (suppressed: boolean) => void
    /** 清空链接预览 WebView 分区的缓存、Cookie 与本地存储 */
    clearWebviewBrowsingData: () => Promise<{ ok: boolean; error?: string }>
  }
  update: {
    check: () => Promise<UpdateCheckResult>
    download: (payload: UpdateDownloadPayload) => Promise<UpdateDownloadResult>
  }
  files: {
    /** 弹出保存对话框并写入文本；用户取消时返回 false */
    saveText: (content: string, defaultFileName: string) => Promise<boolean>
    /** 弹出保存对话框并写入图片；用户取消时返回 false */
    saveImage: (input: SaveImageInput) => Promise<boolean>
    /** 本机文件系统树根（盘符或 /） */
    listRoots: () => Promise<import('./ssh-types').ScpListResult>
    listFavorites: () => Promise<import('./filesystem-favorites-types').FilesystemFavorite[]>
    addFavorite: (
      path: string,
    ) => Promise<import('./filesystem-favorites-types').FilesystemFavoriteAddResult>
    removeFavorite: (id: string) => Promise<{ ok: boolean }>
    getImagePreviewUrl: (filePath: string) => Promise<import('../fs-service').ImagePreviewResult>
    getTerminalFilePreviewUrl: (
      filePath: string,
      kind: import('./terminal-preview-files').TerminalPreviewFileKind,
    ) => Promise<import('../fs-service').ImagePreviewResult>
    detectProgram: (options: {
      kind: 'vscode' | 'cursor' | 'custom'
      path?: string
    }) => Promise<import('../fs-service').ProgramDetectResult>
    openWithProgram: (
      programPath: string,
      targetPath: string,
    ) => Promise<import('../fs-service').OpenWithProgramResult>
    /** Electron：从拖放 File 对象解析本地绝对路径 */
    getPathForFile: (file: File) => string
    resolveTerminalDropDirectory: (
      filePath: string,
    ) => Promise<import('../fs-service').TerminalDropDirectoryResult>
    /** 选择 SSH 私钥文件；取消时返回 null */
    pickPrivateKey: () => Promise<string | null>
    /** 选择 AI 边栏附件（多选）；取消时返回空数组 */
    pickAiAttachments: (dialogTitle?: string) => Promise<import('./ai-attachment-types').AiAttachmentPickFile[]>
  }
  drawing: {
    openFile: (
      kind: import('./drawing-file-types').DrawingFileKind,
    ) => Promise<import('./drawing-file-types').DrawingOpenFileResult>
    saveFile: (
      input: import('./drawing-file-types').DrawingSaveFileInput,
    ) => Promise<import('./drawing-file-types').DrawingSaveFileResult>
  }
  markdown: {
    readFile: (filePath: string) => Promise<import('./markdown-file-types').MarkdownReadFileResult>
    openFile: () => Promise<import('./markdown-file-types').MarkdownOpenFileResult>
    saveFile: (
      input: import('./markdown-file-types').MarkdownSaveFileInput,
    ) => Promise<import('./markdown-file-types').MarkdownSaveFileResult>
  }
  logging: {
    /** 在资源管理器中打开日志文件所在目录 */
    openLogDirectory: () => Promise<void>
  }
  statistics: {
    get: () => Promise<import('./usage-statistics-data').UsageStatisticData>
    recordTabOpen: () => void
    recordTabClose: () => void
    clear: () => Promise<void>
  }
  reminder: {
    list: () => Promise<import('./reminder-data').ReminderItem[]>
    save: (item: import('./reminder-data').ReminderItem) => Promise<import('./reminder-data').ReminderItem>
    delete: (id: string) => Promise<void>
    snooze: (ids: string[], minutes: number) => Promise<void>
    dismiss: (ids: string[]) => Promise<void>
    clearCompleted: () => Promise<number>
    pickImage: () => Promise<import('../reminder-image-service').ReminderImagePickResult>
    clearImage: () => Promise<import('../reminder-image-service').ReminderImageClearResult>
    getImageUrl: () => Promise<
      | { ok: true; url: string }
      | { ok: false; error: string }
    >
    listPets: () => Promise<string[]>
    importPet: (name: string) => Promise<import('../pet-store').PetImportResult>
    deletePet: (petId: string) => Promise<import('../pet-store').PetDeleteResult>
    listPetAnimationStates: (petId: string) => Promise<import('../pet-store').PetAnimationStateDto[]>
    getPetPreviewUrl: (
      petId: string,
    ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>
    onDue: (cb: (payload: import('./reminder-data').ReminderDuePayload) => void) => () => void
  }
  rdp: {
    /** 使用已保存的 RDP 连接启动系统 mstsc（仅 Windows） */
    connect: (connectionId: string) => Promise<ExternalLaunchResult>
  }
  putty: {
    /** 使用已保存的 PuTTY 连接启动 putty.exe（仅 Windows） */
    connect: (connectionId: string) => Promise<ExternalLaunchResult>
  }
  vnc: {
    /** 启动本地 WebSocket↔TCP 代理，并返回可供 noVNC 连接的 ws:// URL */
    startProxy: (input: {
      tabId: string
      host: string
      port: number
    }) => Promise<{ wsUrl: string }>
    /** 关闭指定 tab 的代理并释放资源 */
    stopProxy: (input: { tabId: string }) => Promise<void>
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

  screenshot: {
    /** 打开截图（electron-screenshots） */
    open: () => void
    /** 结束截图 */
    close: () => void
  }
  connectivity: {
    check: (
      input: import('./connectivity-check-types').ConnectivityCheckRequest,
    ) => Promise<import('./connectivity-check-types').ConnectivityCheckResult>
  }
  p2p: {
    getStatus: () => Promise<import('./p2p-types').P2pStatus>
    scan: () => Promise<import('./p2p-types').P2pPeerInfo[]>
    connect: (host: string, port: number, message?: string) => Promise<import('./p2p-types').P2pConnectResult>
    acceptRequest: (requestId: string) => Promise<import('./p2p-types').P2pResult>
    rejectRequest: (requestId: string) => Promise<import('./p2p-types').P2pResult>
    disconnect: (sessionId: string) => Promise<import('./p2p-types').P2pResult>
    sendText: (sessionId: string, text: string) => Promise<import('./p2p-types').P2pResult>
    sendFile: (sessionId: string, localPath: string) => Promise<import('./p2p-types').P2pResult>
    pickAndSendFile: (
      sessionId: string,
      imagesOnly?: boolean,
    ) => Promise<import('./p2p-types').P2pResult & { canceled?: boolean }>
    getSessions: () => Promise<import('./p2p-types').P2pSessionInfo[]>
    getConversations: () => Promise<import('./p2p-types').P2pSessionInfo[]>
    openConversation: (deviceId: string) => Promise<import('./p2p-types').P2pOpenConversationResult>
    hideFromSidebar: (sessionId: string) => Promise<import('./p2p-types').P2pResult>
    removeConversation: (sessionId: string) => Promise<import('./p2p-types').P2pResult>
    getHistory: (sessionId: string) => Promise<import('./p2p-types').P2pHistoryResult>
    getFullHistory: (sessionId: string) => Promise<import('./p2p-types').P2pHistoryResult>
    clearHistory: (sessionId: string) => Promise<import('./p2p-types').P2pResult>
    openChatDirectory: () => Promise<void>
    onSessionRequest: (cb: (request: import('./p2p-types').P2pIncomingRequest) => void) => () => void
    onSessionEstablished: (cb: (session: import('./p2p-types').P2pSessionInfo) => void) => () => void
    onSessionDisconnected: (cb: (session: import('./p2p-types').P2pSessionInfo) => void) => () => void
    onSessionClosed: (cb: (payload: { sessionId: string }) => void) => () => void
    onConversationHidden: (cb: (payload: { sessionId: string }) => void) => () => void
    onMessage: (cb: (message: import('./p2p-types').P2pChatMessage) => void) => () => void
    onFileProgress: (cb: (progress: import('./p2p-types').P2pFileProgress) => void) => () => void
  }

  notes: {
    list: () => Promise<import('./note-types').NoteItem[]>
    save: (input: {
      id?: string
      title?: string
      content?: string
    }) => Promise<import('./note-types').NoteItem>
    delete: (id: string) => Promise<void>
  }
  repo: {
    detectGit: () => Promise<import('./repo-types').GitDetectResult>
    pickDirectory: () => Promise<string | null>
    pickParentDirectory: () => Promise<string | null>
    validateRepo: (path: string) => Promise<import('./repo-types').GitRepoValidateResult>
    listManaged: () => Promise<import('./repo-types').ManagedRepoSummary[]>
    add: (
      path: string,
    ) => Promise<
      | { ok: true; repo: import('./repo-types').ManagedRepo }
      | { ok: false; error: 'DUPLICATE' }
      | import('./repo-types').GitRepoValidateResult
    >
    remove: (id: string) => Promise<boolean>
    pull: (id: string) => Promise<import('./repo-types').GitPullResult>
    clone: (
      params: import('./repo-types').GitCloneParams,
    ) => Promise<import('./repo-types').GitCloneResult>
    onCloneOutput: (cb: (chunk: string) => void) => () => void
    listBranches: (
      id: string,
    ) => Promise<import('./repo-types').GitBranchInfo[] | { error: string }>
    checkout: (id: string, branch: string) => Promise<import('./repo-types').GitCheckoutResult>
    getGraphCommits: (
      id: string,
      cursor?: import('./repo-types').GitGraphCursor,
    ) => Promise<import('./repo-types').GitGraphCommitsResult | { error: string }>
    getCommitDetail: (
      id: string,
      sha: string,
    ) => Promise<import('./repo-types').GitCommitDetail | { error: string }>
    getCommitFileDiff: (
      id: string,
      sha: string,
      filePath: string,
    ) => Promise<import('./repo-types').GitCommitFileDiff | { error: string }>
    getById: (id: string) => Promise<import('./repo-types').ManagedRepo | null>
  }
  session: {
    listClaudeCodeSessions: (
      historyPath?: string,
    ) => Promise<import('./session-types').ListClaudeCodeSessionsResult>
    listOpenCodeSessions: (
      dbPath?: string,
    ) => Promise<import('./session-types').ListOpenCodeSessionsResult>
  }
  workspace: {
    getHomeDir: () => Promise<string>
    listDir: (dirPath: string) => Promise<import('./workspace-types').WorkspaceListDirResponse>
    pickDirectory: () => Promise<string | null>
    detectGit: (workDir: string) => Promise<import('./workspace-types').WorkspaceDetectGitResponse>
    gitStatus: (workDir: string) => Promise<import('./workspace-types').WorkspaceGitStatusResponse>
    gitDiff: (
      workDir: string,
      filePath: string,
    ) => Promise<import('./workspace-types').WorkspaceGitDiffResponse>
    listHistory: () => Promise<import('./workspace-history-types').WorkspaceHistoryEntry[]>
    recordHistory: (
      input: import('./workspace-history-types').WorkspaceHistoryRecordInput,
    ) => Promise<import('./workspace-history-types').WorkspaceHistoryEntry[]>
  }
}
