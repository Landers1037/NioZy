import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  dialog,
  screen,
} from 'electron'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'node:url'
import { TerminalService } from '../terminal-service'
import { SettingsStore, isHardwareAccelerationEnabled, isWebGpuAccelerationEnabled } from '../settings-store'
import { StatisticsStore } from '../statistics-store'
import { resumeTermStore } from '../resume-term-store'
import { ReminderStore } from '../reminder-store'
import { ReminderScheduler } from '../reminder-scheduler'
import { SystemStats } from '../system-stats'
import { statusBarPollIntervalMs, normalizeStatusBarPollPriority } from '../shared/status-bar-poll'
import { getAppMetricsSnapshot } from '../app-metrics'
import { VaultStore } from '../vault-store'
import { listSystemFonts } from '../font-store'
import { syncGlobalShortcuts, unregisterGlobalShortcuts } from '../global-shortcuts'
import { sendToRenderer } from './window-ipc'
import { createTerminalOutputFlusher } from './terminal-output-flush'
import { createTerminalKillQueue } from '../terminal-kill-queue'
import { augmentWindowsPath } from '../resolve-executable'
import { loadTrayIcon } from '../tray-icon'
import {
  syncCopilotRuntime,
  disposeCopilotRuntime,
  getCopilotRuntimeUrl,
} from '../copilot/lazy'
import {
  buildAiRuntimeConfig,
  resolveAiRuntimeConfig,
  sanitizeResolvedAiRuntimeConfig,
} from '../shared/experimental-settings'
import { containsVaultReference } from '../shared/vault-reference'
import {
  applyChromiumPerformanceFlags,
  applyWebGpuFlags,
  getOptimizedWebPreferences,
  syncInactiveTabSleepThrottling,
} from '../chromium-tuning'
import { readPerformanceSettingsFromDisk } from '../performance-settings-disk'
import { configureSessionPrivacy, disableCrashReporting } from '../session-privacy'
import {
  flushPendingOpenDirectory,
  parseOpenRequestFromArgv,
  queueOpenDirectory,
  setInitialOpenDirectoryFromArgv,
  takePendingOpenDirectory,
} from '../open-directory'
import {
  isWindowsShellContextMenuSupported,
  setWindowsShellContextMenu,
} from '../windows-shell-context-menu'
import {
  syncAllConnectionContextMenus,
  syncConnectionContextMenus,
} from '../windows-connection-context-menu'
import { p2pService } from '../p2p/p2p-service'
import { ensureChatDir, getChatDir } from '../config-paths'
import { scpLog, scpProfileForLog } from '../scp-logger'
import { resolveTerminalImageProtocolFromSettings } from '../shared/shell-settings'
import { normalizeTerminalEmulator } from '../shared/experimental-settings'
import type {
  CustomConnection,
  SshConnectionProfile,
  TerminalCreateOptions,
} from '../shared/api-types'
import type { ScpTransferProgress } from '../shared/ssh-types'
import * as sshService from '../ssh-service'
import * as fsService from '../fs-service'
import { captureWindowState, getInitialWindowOptions } from '../window-bounds'
import { reloadSystemEnvironment } from '../reload-system-env'
import { isWindowsProcessElevated } from '../windows-admin'
import { checkForAppUpdate, downloadAndInstallUpdate } from '../app-update'
import { inferSshAuth, resolveSshConnectionPassword } from '../ssh-auth'
import { applySshConnectionToTerminalOptions } from '../ssh-terminal-spawn'
import { scheduleSshStartupScript } from '../ssh-startup-script'
import { launchRdpFromConnection } from '../rdp-launch'
import { launchPuttyFromConnection } from '../putty-launch'
import { runConnectivityCheck } from '../connectivity-check-service'
import { GitService } from '../git-service'
import { WorkspaceService } from '../workspace-service'
import { listClaudeCodeSessions, listOpenCodeSessions } from '../session-service'
import { getWindowBackgroundColor } from '../shared/ui-style'
import { isElectronDev } from '../shared/is-dev'
import {
  allowDevToolsForContents,
  installReleaseDevToolsGuard,
} from '../shared/release-devtools-guard'
import { NoteStore } from '../note-store'
import { FilesystemFavoritesStore } from '../filesystem-favorites-store'
import { WorkspaceHistoryStore } from '../workspace-history-store'
import {
  registerLocalFileScheme,
  registerLocalFileProtocolHandler,
} from '../local-file-protocol'
import { LinkPreviewManager } from '../link-preview-manager'
import { applySessionProxy } from '../session-proxy'
import {
  clearWebviewPreviewBrowsingData,
  initWebviewPreviewSession,
  syncWebviewPreviewCustomHeaders,
  syncWebviewPreviewProxy,
} from '../webview-preview-session'
import { listPetReminderItems } from '../shared/pet-reminder-dto'
import { getPetUiLabels } from '../shared/pet-ui-labels'
import { buildInitialSettingsArgv } from '../shared/initial-settings'
import { summarizeSettingsPatch } from '../settings-patch-log'
import {
  applyLoggingSettings,
  logErrorPayload,
  mainLog,
  copilotLog,
  settingsLog,
  terminalLog,
  vaultLog,
  resolveLogFilePath,
} from '../app-log'
import {
  closeScreenshotCapture,
  configureScreenshotsService,
  disposeScreenshotsService,
  initScreenshotsService,
  openScreenshotCapture,
  syncScreenshotsLang,
} from '../screenshots-service'
import {
  configureDesktopPetService,
  disposeDesktopPet,
  notifyPetReminderDue,
  onPetPointerDown,
  onPetPointerMove,
  onPetPointerUp,
  onPetReady,
  setPetWindowCompact,
  setPetWindowDueAlert,
  setPetWindowReminderAndDue,
  setPetWindowReminderList,
  onPetShowMenu,
  onPetToggleMain,
  scheduleDesktopPetStartupSync,
  syncDesktopPet,
} from '../desktop-pet-service'

registerLocalFileScheme()

augmentWindowsPath()

setInitialOpenDirectoryFromArgv(process.argv)

// On Windows, the taskbar pinned icon is tied to the AppUserModelID.
// Keep it stable across updates to prevent pinned icons from disappearing.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.niozy.app')
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  mainLog.warn('Second instance blocked; quitting')
  app.quit()
}

if (!isHardwareAccelerationEnabled()) {
  app.disableHardwareAcceleration()
}

applyWebGpuFlags(isWebGpuAccelerationEnabled())

disableCrashReporting()
const performanceSettingsAtLaunch = readPerformanceSettingsFromDisk()
applyChromiumPerformanceFlags({
  inactiveTabSleep: performanceSettingsAtLaunch.inactiveTabSleep,
})
installReleaseDevToolsGuard()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let linkPreviewManager: LinkPreviewManager | null = null
let vncProxyManager: import('../vnc-proxy').VncWsProxyManager | null = null

/** 由“点击布局面板分屏”触发的可还原状态 */
let mainWindowSnapRestoreBounds: Electron.Rectangle | null = null

type SnapLayout =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'

function computeSnapBounds(area: Electron.Rectangle, layout: SnapLayout): Electron.Rectangle {
  const halfW = Math.floor(area.width / 2)
  const halfH = Math.floor(area.height / 2)
  const leftW = halfW
  const rightW = area.width - halfW
  const topH = halfH
  const bottomH = area.height - halfH

  if (layout === 'right') return { x: area.x + leftW, y: area.y, width: rightW, height: area.height }
  if (layout === 'top') return { x: area.x, y: area.y, width: area.width, height: topH }
  if (layout === 'bottom') return { x: area.x, y: area.y + topH, width: area.width, height: bottomH }
  if (layout === 'topLeft') return { x: area.x, y: area.y, width: leftW, height: topH }
  if (layout === 'topRight') return { x: area.x + leftW, y: area.y, width: rightW, height: topH }
  if (layout === 'bottomLeft') return { x: area.x, y: area.y + topH, width: leftW, height: bottomH }
  if (layout === 'bottomRight') return { x: area.x + leftW, y: area.y + topH, width: rightW, height: bottomH }
  // left
  return { x: area.x, y: area.y, width: leftW, height: area.height }
}

function computeDefaultCenteredBoundsForWindow(
  win: BrowserWindow,
): Electron.Rectangle {
  const defaults = getInitialWindowOptions(undefined)
  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const area = display.workArea
  const width = Math.min(defaults.width, area.width)
  const height = Math.min(defaults.height, area.height)
  const x = Math.round(area.x + (area.width - width) / 2)
  const y = Math.round(area.y + (area.height - height) / 2)
  return { x, y, width, height }
}

function getLinkPreviewManager(): LinkPreviewManager {
  if (!linkPreviewManager) {
    linkPreviewManager = new LinkPreviewManager(
      () => mainWindow,
      settingsStore.get().advanced.disableSandbox,
    )
  }
  return linkPreviewManager
}

async function syncSessionProxyFromSettings(): Promise<void> {
  await applySessionProxy(settingsStore.get().system.proxy)
}

async function syncWebviewPreviewFromSettings(): Promise<void> {
  const settings = settingsStore.get()
  syncWebviewPreviewCustomHeaders(settings.preview.webviewCustomHeaders)
  await syncWebviewPreviewProxy(settings.system.proxy)
}

function syncGitPathFromSettings(): void {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
}

async function syncAllSettingsSideEffects(): Promise<void> {
  const updated = settingsStore.get()
  syncGitPathFromSettings()
  await syncShellContextMenuRegistry(updated.advanced.shellContextMenu)
  app.setLoginItemSettings({ openAtLogin: updated.system.launchOnStartup })
  syncGlobalShortcuts(settingsStore, () => mainWindow)
  syncWindowOpacity()
  applyLoggingSettings(updated.logging)
  mainWindow?.setBackgroundColor(
    getWindowBackgroundColor(updated.theme, updated.uiStyle),
  )
  syncInactiveTabSleepThrottling(mainWindow, updated.performance.inactiveTabSleep)
  await syncSessionProxyFromSettings()
  await syncWebviewPreviewFromSettings()
  syncSystemStatsPolling()
}

const isDev = isElectronDev()

const terminalService = new TerminalService()
const terminalKillQueue = createTerminalKillQueue((id) => terminalService.kill(id))
const terminalOutputFlusher = createTerminalOutputFlusher(() => mainWindow)
let windowDragging = false

function setWindowDragging(moving: boolean): void {
  if (moving) {
    if (windowDragging) return
    windowDragging = true
    terminalOutputFlusher.pause()
    sendToRenderer(mainWindow, 'window:moving', true)
    return
  }
  if (!windowDragging) return
  windowDragging = false
  terminalOutputFlusher.resume()
  sendToRenderer(mainWindow, 'window:moving', false)
}
const settingsStore = new SettingsStore()
const statisticsStore = new StatisticsStore(
  () => settingsStore.get().statistics.enabled === true,
)
const reminderStore = new ReminderStore()
const reminderScheduler = new ReminderScheduler(
  reminderStore,
  settingsStore,
  (win, payload) => {
    sendToRenderer(win, 'reminder:due', payload)
    notifyPetReminderDue(payload)
  },
  () => mainWindow,
)
const vaultStore = new VaultStore()
const gitService = new GitService()
const workspaceService = new WorkspaceService(gitService)
const systemStats = new SystemStats()
const noteStore = new NoteStore()
const filesystemFavoritesStore = new FilesystemFavoritesStore()
filesystemFavoritesStore.load()
const workspaceHistoryStore = new WorkspaceHistoryStore()
workspaceHistoryStore.load()

function syncStatisticsPolling(): void {
  statisticsStore.syncPolling()
}

function syncReminderScheduler(): void {
  const enabled = settingsStore.get().reminder.enabled === true
  if (enabled) {
    reminderScheduler.start()
    reminderScheduler.reschedule()
  } else {
    reminderScheduler.stop()
  }
}
async function syncCopilotRuntimeFromSettings(
  experimental = settingsStore.get().experimental,
): Promise<void> {
  vaultStore.load()
  const built = buildAiRuntimeConfig(experimental)
  const resolved = sanitizeResolvedAiRuntimeConfig(
    built.apiKey,
    resolveAiRuntimeConfig(built, (text) => vaultStore.resolveText(text)),
  )
  await syncCopilotRuntime(resolved)
}

function syncCopilotRuntimeFromSettingsSafe(
  experimental = settingsStore.get().experimental,
): void {
  void syncCopilotRuntimeFromSettings(experimental).catch((err) =>
    copilotLog.error('Failed to sync runtime', logErrorPayload(err)),
  )
}

async function syncCopilotRuntimeIfAiApiKeyUsesVault(): Promise<void> {
  const key = settingsStore.get().experimental.aiApiKey
  if (!containsVaultReference(key)) return
  await syncCopilotRuntimeFromSettings()
}

async function syncP2PFromSettings(): Promise<void> {
  p2pService.configure(() => mainWindow)
  const result = await p2pService.start(settingsStore.get().p2p)
  if (!result.ok && result.error) {
    mainLog.warn('P2P service failed to start', { error: result.error })
  }
}

function experimentalAiSettingsChanged(partial: Parameters<SettingsStore['update']>[0]): boolean {
  if (!partial.experimental) return false
  const keys = [
    'aiSidebarEnabled',
    'aiSidebarWidth',
    'aiRuntimePort',
    'aiProvider',
    'aiModel',
    'aiBaseUrl',
    'aiApiKey',
    'openAiApiKey',
  ] as const
  return keys.some((key) => partial.experimental![key] !== undefined)
}

function isStatusBarLiveStatsEnabled(): boolean {
  return settingsStore.get().advanced.statusBarLiveStats !== false
}

function isStatusBarBatteryEnabled(): boolean {
  return settingsStore.get().advanced.statusBarBattery === true
}

function getStatusBarPollIntervalMs(): number {
  const priority = normalizeStatusBarPollPriority(settingsStore.get().advanced.statusBarPollPriority)
  return statusBarPollIntervalMs(priority)
}

function syncSystemStatsPolling(): void {
  systemStats.stop()
  const liveStats = isStatusBarLiveStatsEnabled()
  const battery = isStatusBarBatteryEnabled()
  if (!liveStats && !battery) return
  systemStats.start(
    (stats) => {
      sendToRenderer(mainWindow, 'system:stats', stats)
    },
    getStatusBarPollIntervalMs(),
    { liveStats, battery },
  )
}

/** 将设置中的透明度百分比 (70–100) 映射为 Electron 窗口不透明度 (0.7–1) */
function transparencyToOpacity(transparency: number): number {
  return Math.min(1, Math.max(0.7, transparency / 100))
}

function syncWindowOpacity(): void {
  if (!mainWindow) return
  mainWindow.setOpacity(transparencyToOpacity(settingsStore.get().advanced.transparency))
}

function persistWindowBoundsIfEnabled(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const s = settingsStore.get()
  if (!s.advanced.preserveWindowBounds) return
  settingsStore.update({
    advanced: {
      ...s.advanced,
      lastWindowState: captureWindowState(mainWindow),
    },
  })
}

function destroyTray(): void {
  if (!tray) return
  tray.destroy()
  tray = null
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (!isQuitting) createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function quitAppFromUserClose(): void {
  if (isQuitting) return
  isQuitting = true
  disposeDesktopPet()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.closeDevTools()
  }
  destroyTray()
  app.quit()
}

function requestNewTerminalFromTray(): void {
  showMainWindow()
  sendToRenderer(mainWindow, 'app:newTerminal')
}

function requestOpenSettingsFromTray(): void {
  showMainWindow()
  sendToRenderer(mainWindow, 'app:openSettings')
}

function requestOpenDevToolsFromTray(): void {
  showMainWindow()
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    allowDevToolsForContents(mainWindow.webContents)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function notifyRendererSettingsChanged(): void {
  sendToRenderer(mainWindow, 'settings:changed', settingsStore.get())
}

type TrayMenuLabels = {
  newTerminal: string
  openSettings: string
  openDevTools: string
  showApp: string
  enableDesktopPet: string
  disableDesktopPet: string
  quit: string
}

function getTrayMenuLabels(): TrayMenuLabels {
  const locale = settingsStore.get().locale ?? 'zh'
  if (locale === 'en') {
    return {
      newTerminal: 'New terminal',
      openSettings: 'Open settings',
      openDevTools: 'Open DevTools',
      showApp: 'Show NioZy',
      enableDesktopPet: 'Enable desktop pet',
      disableDesktopPet: 'Disable desktop pet',
      quit: 'Quit',
    }
  }
  if (locale === 'ja') {
    return {
      newTerminal: '新しいターミナル',
      openSettings: '設定を開く',
      openDevTools: 'DevTools を開く',
      showApp: 'NioZy を表示',
      enableDesktopPet: 'デスクトップペットをオン',
      disableDesktopPet: 'デスクトップペットをオフ',
      quit: '終了',
    }
  }
  return {
    newTerminal: '新建终端',
    openSettings: '打开设置',
    openDevTools: '打开 DevTools',
    showApp: '显示 NioZy',
    enableDesktopPet: '打开桌面宠物',
    disableDesktopPet: '关闭桌面宠物',
    quit: '退出',
  }
}

function toggleDesktopPetEnabled(): void {
  const reminder = settingsStore.get().reminder
  settingsStore.update({
    reminder: {
      ...reminder,
      desktopPetEnabled: !reminder.desktopPetEnabled,
    },
  })
  syncDesktopPet()
  refreshTrayMenu()
  notifyRendererSettingsChanged()
}

function buildTrayContextMenu(): Menu {
  const labels = getTrayMenuLabels()
  const petEnabled = settingsStore.get().reminder.desktopPetEnabled === true
  return Menu.buildFromTemplate([
    { label: labels.newTerminal, click: () => requestNewTerminalFromTray() },
    { label: labels.openSettings, click: () => requestOpenSettingsFromTray() },
    { label: labels.openDevTools, click: () => requestOpenDevToolsFromTray() },
    { type: 'separator' },
    {
      label: petEnabled ? labels.disableDesktopPet : labels.enableDesktopPet,
      click: () => toggleDesktopPetEnabled(),
    },
    { type: 'separator' },
    { label: labels.showApp, click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}

function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildTrayContextMenu())
}

async function syncShellContextMenuRegistry(enabled: boolean): Promise<void> {
  if (!isWindowsShellContextMenuSupported()) return
  await setWindowsShellContextMenu(enabled)
}

function handleOpenDirectoryRequest(directory: string, connectionId?: string | null): void {
  showMainWindow()
  queueOpenDirectory(mainWindow, directory, connectionId ?? undefined)
}

function resolvePreloadPath(): string {
  const candidates = [
    fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
    join(app.getAppPath(), 'out/preload/index.mjs'),
    join(__dirname, '../preload/index.mjs'),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return candidates[0]
}

function createWindow(): void {
  const settings = settingsStore.get()
  const preloadPath = resolvePreloadPath()
  const savedState = settings.advanced.preserveWindowBounds
    ? settings.advanced.lastWindowState
    : undefined
  const initialBounds = getInitialWindowOptions(savedState)

  mainLog.debug('Creating main window', {
    preloadPath,
    preloadExists: existsSync(preloadPath),
    preserveBounds: Boolean(savedState),
  })

  mainWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    ...(initialBounds.x !== undefined && initialBounds.y !== undefined
      ? { x: initialBounds.x, y: initialBounds.y }
      : {}),
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: getWindowBackgroundColor(settings.theme, settings.uiStyle),
    opacity: transparencyToOpacity(settings.advanced.transparency),
    webPreferences: {
      ...getOptimizedWebPreferences(preloadPath, {
        disableSandbox: settings.advanced.disableSandbox,
        inactiveTabSleep: settings.performance.inactiveTabSleep,
      }),
      additionalArguments: [buildInitialSettingsArgv(settings)],
    },
  })

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false)
  }

  mainWindow.webContents.on('preload-error', (_, path, error) => {
    mainLog.error('Failed to load preload', { path, error: logErrorPayload(error) })
  })

  syncInactiveTabSleepThrottling(mainWindow, settings.performance.inactiveTabSleep)

  mainWindow.on('ready-to-show', () => {
    syncWindowOpacity()
    if (initialBounds.startMaximized) {
      mainWindow?.maximize()
    }
    mainLog.info('Main window ready')
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    flushPendingOpenDirectory(mainWindow)
    if (isDev && mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.on('maximize', () => {
    sendToRenderer(mainWindow, 'window:maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    sendToRenderer(mainWindow, 'window:maximized', false)
  })

  mainWindow.on('will-move', () => {
    setWindowDragging(true)
  })
  mainWindow.on('moved', () => {
    setWindowDragging(false)
  })

  mainWindow.on('closed', () => {
    mainLog.info('Main window closed')
    mainWindow = null
  })

  mainWindow.on('close', (e) => {
    persistWindowBoundsIfEnabled()
    if (isQuitting) return
    const s = settingsStore.get()
    if (s.system.minimizeToTrayOnClose) {
      e.preventDefault()
      mainWindow?.hide()
      return
    }
    quitAppFromUserClose()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  tray = new Tray(loadTrayIcon(__dirname))
  tray.setToolTip('NioZy')
  refreshTrayMenu()
  tray.on('double-click', () => showMainWindow())
}

if (gotSingleInstanceLock) {
  app.on('second-instance', (_event, argv) => {
    const request = parseOpenRequestFromArgv(argv)
    mainLog.info('Second instance', {
      directory: request?.directory ?? null,
      connectionId: request?.connectionId ?? null,
    })
    if (request) handleOpenDirectoryRequest(request.directory, request.connectionId)
    else showMainWindow()
  })
}

app.whenReady().then(async () => {
  mainLog.info('Application ready', {
    version: app.getVersion(),
    platform: process.platform,
    isDev,
  })

  Menu.setApplicationMenu(null)
  configureSessionPrivacy()
  await registerLocalFileProtocolHandler()

  settingsStore.load()
  syncGitPathFromSettings()
  vaultStore.load()
  const logging = settingsStore.get().logging
  applyLoggingSettings(logging)
  settingsLog.info('Settings loaded', {
    configDir: settingsStore.getConfigDir(),
    connectionCount: settingsStore.get().connections.length,
    loggingEnabled: logging.enabled,
    loggingLevel: logging.level,
  })
  syncCopilotRuntimeFromSettingsSafe()
  await syncSessionProxyFromSettings()
  initWebviewPreviewSession()
  await syncWebviewPreviewFromSettings()
  linkPreviewManager = new LinkPreviewManager(
    () => mainWindow,
    settingsStore.get().advanced.disableSandbox,
  )

  mainLog.debug('Paths', { appPath: app.getAppPath(), mainDir: __dirname })

  createWindow()
  p2pService.configure(() => mainWindow)
  void syncP2PFromSettings()
  createTray()
  syncSystemStatsPolling()
  syncStatisticsPolling()
  syncReminderScheduler()
  syncGlobalShortcuts(settingsStore, () => mainWindow)
  configureScreenshotsService({
    getMainWindow: () => mainWindow,
    shouldHideSelf: () => settingsStore.get().assistive.screenshotHideSelf === true,
  })
  configureDesktopPetService({
    getMainWindow: () => mainWindow,
    settingsStore,
    requestNewTerminal: () => requestNewTerminalFromTray(),
    onSettingsChanged: () => {
      refreshTrayMenu()
      notifyRendererSettingsChanged()
    },
  })
  scheduleDesktopPetStartupSync()
  initScreenshotsService(settingsStore.get().locale)

  if (settingsStore.get().advanced.shellContextMenu) {
    void syncShellContextMenuRegistry(true).catch((err) => {
      mainLog.error('Failed to sync shell context menu registry', logErrorPayload(err))
    })
  }
  void syncAllConnectionContextMenus(settingsStore.get().connections).catch((err) => {
    mainLog.error('Failed to sync connection context menu registry', logErrorPayload(err))
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const s = settingsStore.get()
    if (!s.system.minimizeToTrayOnClose) quitAppFromUserClose()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  mainLog.info('Application quitting')
  persistWindowBoundsIfEnabled()
  destroyTray()
  linkPreviewManager?.closeAll()
  terminalOutputFlusher.dispose()
  terminalService.disposeAll()
  void vncProxyManager?.disposeAll()
  unregisterGlobalShortcuts()
  void disposeScreenshotsService()
  disposeDesktopPet()
  systemStats.stop()
  systemStats.dispose()
  statisticsStore.dispose()
  void disposeCopilotRuntime(true).catch((err) =>
    copilotLog.error('Failed to stop runtime', logErrorPayload(err)),
  )
  void p2pService.stop()
})

app.on('will-quit', () => {
  unregisterGlobalShortcuts()
})

ipcMain.on('window:setTransparencyPreview', (_, transparency: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setOpacity(transparencyToOpacity(transparency))
})

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:setDragging', (_, moving: boolean) => {
  setWindowDragging(moving === true)
})
ipcMain.on('pet:ready', () => onPetReady())
ipcMain.on('pet:pointerDown', () => onPetPointerDown())
ipcMain.on('pet:pointerMove', () => onPetPointerMove())
ipcMain.on('pet:pointerUp', () => onPetPointerUp())
ipcMain.on('pet:toggleMain', () => onPetToggleMain())
ipcMain.on('pet:showMenu', () => onPetShowMenu())
ipcMain.on('pet:setWindowCompact', () => setPetWindowCompact())
ipcMain.on('pet:setWindowReminderList', () => setPetWindowReminderList())
ipcMain.on('pet:setWindowDueAlert', () => setPetWindowDueAlert())
ipcMain.on('pet:setWindowReminderAndDue', () => setPetWindowReminderAndDue())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('window:toggleSnapRestore', () => {
  const win = mainWindow
  if (!win || win.isDestroyed()) return false
  const restore = mainWindowSnapRestoreBounds
  if (!restore) return false

  try {
    win.setBounds(restore)
    win.show()
    win.focus()
    return true
  } catch {
    return false
  } finally {
    mainWindowSnapRestoreBounds = null
  }
})
ipcMain.on(
  'window:snap',
  (
    _e,
    layout:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'topLeft'
      | 'topRight'
      | 'bottomLeft'
      | 'bottomRight',
  ) => {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  try {
    if (win.isMaximized()) win.unmaximize()
  } catch {
    // ignore
  }

  // 只要用户从面板点击了分屏布局，就记录一次“可还原状态”
  // 还原时不回到上一次尺寸，而回到默认窗口大小并居中（按你的需求）
  mainWindowSnapRestoreBounds = computeDefaultCenteredBoundsForWindow(win)

  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const area = display.workArea
  const next = computeSnapBounds(area, layout)

  try {
    win.setBounds(next)
    win.show()
    win.focus()
  } catch {
    // ignore
  }
  },
)

ipcMain.on('shell:openExternal', (_, url: string) => {
  void shell.openExternal(url)
})

ipcMain.handle('logging:openLogDirectory', async (): Promise<void> => {
  const logPath = resolveLogFilePath(settingsStore.get().logging.filePath)
  const dir = dirname(logPath)
  const result = await shell.openPath(dir)
  if (result) {
    throw new Error(result)
  }
})

ipcMain.handle('p2p:getStatus', () => p2pService.getStatus())
ipcMain.handle('p2p:scan', () => p2pService.scan())
ipcMain.handle('p2p:connect', (_, host: string, port: number, message?: string) =>
  p2pService.connect(host, port, message),
)
ipcMain.handle('p2p:acceptRequest', (_, requestId: string) => p2pService.acceptRequest(requestId))
ipcMain.handle('p2p:rejectRequest', (_, requestId: string) => p2pService.rejectRequest(requestId))
ipcMain.handle('p2p:disconnect', (_, sessionId: string) => p2pService.disconnect(sessionId))
ipcMain.handle('p2p:sendText', (_, sessionId: string, text: string) =>
  p2pService.sendText(sessionId, text),
)
ipcMain.handle('p2p:sendFile', (_, sessionId: string, localPath: string) =>
  p2pService.sendFile(sessionId, localPath),
)
ipcMain.handle(
  'p2p:pickAndSendFile',
  async (_, sessionId: string, imagesOnly?: boolean) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: imagesOnly
        ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
        : undefined,
    })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, canceled: true as const }
    }
    return p2pService.sendFile(sessionId, result.filePaths[0])
  },
)
ipcMain.handle('p2p:getSessions', () => p2pService.getSessions())
ipcMain.handle('p2p:getConversations', () => p2pService.getConversations())
ipcMain.handle('p2p:openConversation', (_, deviceId: string) => p2pService.openConversation(deviceId))
ipcMain.handle('p2p:hideFromSidebar', (_, sessionId: string) => p2pService.hideFromSidebar(sessionId))
ipcMain.handle('p2p:removeConversation', (_, sessionId: string) => p2pService.removeConversation(sessionId))
ipcMain.handle('p2p:getHistory', (_, sessionId: string) => p2pService.loadHistory(sessionId))
ipcMain.handle('p2p:getFullHistory', (_, sessionId: string) => p2pService.loadFullHistory(sessionId))
ipcMain.handle('p2p:clearHistory', (_, sessionId: string) => p2pService.clearHistory(sessionId))
ipcMain.handle('p2p:openChatDirectory', async (): Promise<void> => {
  ensureChatDir()
  const result = await shell.openPath(getChatDir())
  if (result) throw new Error(result)
})

ipcMain.handle('terminal:pickBackground', async () => {
  const { pickAndInstallTerminalBackground } = await import('../terminal-background-service')
  return pickAndInstallTerminalBackground(mainWindow)
})

ipcMain.handle('terminal:clearBackground', async () => {
  const { clearTerminalBackgroundFiles } = await import('../terminal-background-service')
  return clearTerminalBackgroundFiles()
})

ipcMain.handle('terminal:getBackgroundUrl', async (_, ext: string) => {
  const { buildTerminalBackgroundPreviewUrlWithCacheBust, terminalBackgroundExists } =
    await import('../terminal-background-service')
  const normalized = typeof ext === 'string' ? ext.replace(/^\./, '').toLowerCase() : ''
  if (!normalized || !terminalBackgroundExists(normalized)) {
    return { ok: false as const, error: 'NOT_FOUND' }
  }
  const url = await buildTerminalBackgroundPreviewUrlWithCacheBust(normalized)
  return { ok: true as const, url }
})

ipcMain.handle('files:pickPrivateKey', async (): Promise<string | null> => {
  const openOptions = {
    title: '选择 SSH 私钥',
    properties: ['openFile'] as ('openFile')[],
    filters: [
      { name: '私钥', extensions: ['pem', 'key', 'ppk'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  }
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || !filePaths[0]) return null
  return filePaths[0]
})

ipcMain.handle(
  'files:pickAiAttachments',
  async (_, dialogTitle?: string): Promise<import('../shared/ai-attachment-types').AiAttachmentPickFile[]> => {
    const {
      MAX_AI_ATTACHMENT_BYTES,
      guessAttachmentMimeType,
    } = await import('../shared/ai-attachment-types')
    const openOptions = {
      title: dialogTitle?.trim() || '选择附件',
      properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
        { name: '文档', extensions: ['pdf', 'txt', 'md', 'json'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || filePaths.length === 0) return []

    const picked: import('../shared/ai-attachment-types').AiAttachmentPickFile[] = []
    for (const filePath of filePaths) {
      const buffer = await readFile(filePath)
      if (buffer.byteLength > MAX_AI_ATTACHMENT_BYTES) {
        const messageBoxOptions = {
          type: 'warning' as const,
          title: '附件过大',
          message: `${filePath.split(/[/\\]/).pop() ?? filePath} 超过 20MB 上限，已跳过。`,
        }
        if (mainWindow) {
          await dialog.showMessageBox(mainWindow, messageBoxOptions)
        } else {
          await dialog.showMessageBox(messageBoxOptions)
        }
        continue
      }
      const name = filePath.split(/[/\\]/).pop() ?? filePath
      picked.push({
        name,
        mimeType: guessAttachmentMimeType(name),
        base64: buffer.toString('base64'),
        size: buffer.byteLength,
      })
    }
    return picked
  },
)

ipcMain.handle(
  'files:saveText',
  async (_, content: string, defaultFileName: string): Promise<boolean> => {
    const saveOptions = {
      title: '导出终端',
      defaultPath: defaultFileName,
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    }
    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (canceled || !filePath) return false
    await writeFile(filePath, content, 'utf8')
    return true
  },
)

function imageSaveFilters(defaultFileName: string) {
  const ext = defaultFileName.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') {
    return [{ name: 'JPEG', extensions: ['jpg', 'jpeg'] }]
  }
  if (ext === 'svg') {
    return [{ name: 'SVG', extensions: ['svg'] }]
  }
  return [{ name: 'PNG', extensions: ['png'] }]
}

ipcMain.handle(
  'files:saveImage',
  async (
    _,
    input: {
      content: string
      encoding: 'utf8' | 'base64'
      defaultFileName: string
      mimeType?: string
    },
  ): Promise<boolean> => {
    const saveOptions = {
      title: '导出终端截图',
      defaultPath: input.defaultFileName,
      filters: imageSaveFilters(input.defaultFileName),
    }
    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (canceled || !filePath) return false
    if (input.encoding === 'base64') {
      await writeFile(filePath, Buffer.from(input.content, 'base64'))
    } else {
      await writeFile(filePath, input.content, 'utf8')
    }
    return true
  },
)

function drawingFileFilters(kind: 'excalidraw' | 'drawio') {
  if (kind === 'excalidraw') {
    return [{ name: 'Excalidraw', extensions: ['excalidraw', 'json'] }]
  }
  return [{ name: 'Draw.io', extensions: ['drawio', 'xml'] }]
}

ipcMain.handle('drawing:openFile', async (_, kind: 'excalidraw' | 'drawio') => {
  const openOptions = {
    title: kind === 'excalidraw' ? '打开 Excalidraw' : '打开 Draw.io',
    properties: ['openFile'] as ('openFile')[],
    filters: drawingFileFilters(kind),
  }
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || !filePaths[0]) return { ok: false, canceled: true as const }
  try {
    const content = await readFile(filePaths[0], 'utf8')
    return { ok: true, path: filePaths[0], content }
  } catch {
    return { ok: false, error: 'READ_FAILED' as const }
  }
})

ipcMain.handle(
  'drawing:saveFile',
  async (
    _,
    input: {
      kind: 'excalidraw' | 'drawio'
      content: string
      defaultFileName: string
      filePath?: string
    },
  ) => {
    let targetPath = input.filePath?.trim()
    if (!targetPath) {
      const saveOptions = {
        title: input.kind === 'excalidraw' ? '保存 Excalidraw' : '保存 Draw.io',
        defaultPath: input.defaultFileName,
        filters: drawingFileFilters(input.kind),
      }
      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, saveOptions)
        : await dialog.showSaveDialog(saveOptions)
      if (canceled || !filePath) return { ok: false, canceled: true as const }
      targetPath = filePath
    }
    try {
      await writeFile(targetPath, input.content, 'utf8')
      return { ok: true, path: targetPath }
    } catch {
      return { ok: false, error: 'WRITE_FAILED' as const }
    }
  },
)

ipcMain.handle('settings:get', () => settingsStore.get())
ipcMain.handle('copilot:getRuntimeUrl', () => getCopilotRuntimeUrl())

ipcMain.handle('aiContext:listRules', async () => {
  const { listAiRules } = await import('../ai-context-store')
  return listAiRules(settingsStore.get().experimental.aiRuleStates)
})
ipcMain.handle('aiContext:readRule', async (_, id: string) => {
  const { readAiRule } = await import('../ai-context-store')
  return readAiRule(id)
})
ipcMain.handle('aiContext:saveRule', async (_, input: { id: string; content: string }) => {
  const { saveAiRule } = await import('../ai-context-store')
  await saveAiRule(input.id, input.content)
})
ipcMain.handle('aiContext:deleteRule', async (_, id: string) => {
  const { deleteAiRule } = await import('../ai-context-store')
  await deleteAiRule(id)
})
ipcMain.handle('aiContext:listSkills', async () => {
  const { listAiSkills } = await import('../ai-context-store')
  return listAiSkills()
})
ipcMain.handle('aiContext:getChatContext', async () => {
  const { buildAiChatContext } = await import('../ai-context-store')
  return buildAiChatContext(settingsStore.get().experimental.aiRuleStates)
})
ipcMain.handle('aiContext:openSkillsDirectory', async (): Promise<void> => {
  const { ensureAiSkillsDir } = await import('../ai-context-store')
  const dir = await ensureAiSkillsDir()
  const result = await shell.openPath(dir)
  if (result) throw new Error(result)
})

ipcMain.handle('settings:exportToFile', async () => {
  const date = new Date().toISOString().slice(0, 10)
  const saveOptions = {
    title: '导出设置',
    defaultPath: `niozy-settings-${date}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  }
  const { canceled, filePath } = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions)
  if (canceled || !filePath) return { ok: false, canceled: true }
  try {
    const content = JSON.stringify(settingsStore.get(), null, 2)
    await writeFile(filePath, content, 'utf8')
    settingsLog.info('Settings exported to file', { filePath })
    return { ok: true }
  } catch {
    return { ok: false, error: 'READ_FAILED' as const }
  }
})

ipcMain.handle('settings:importFromFile', async () => {
  const openOptions = {
    title: '导入设置',
    properties: ['openFile'] as ('openFile')[],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  }
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }
  let content: string
  try {
    content = await readFile(filePaths[0], 'utf8')
  } catch {
    return { ok: false, error: 'READ_FAILED' as const }
  }
  try {
    const { runMainWorkerTask } = await import('../workers/main-worker-pool')
    const parsed = await runMainWorkerTask<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }>(
      'settings:parseImport',
      { content },
    )
    if (!parsed.ok) {
      if (parsed.error === 'INVALID_JSON') return { ok: false, error: 'INVALID_JSON' as const }
      if (parsed.error === 'TOO_LARGE') return { ok: false, error: 'READ_FAILED' as const }
      return { ok: false, error: 'INVALID_FORMAT' as const }
    }
    const updated = settingsStore.importFromExport(parsed.body)
    settingsLog.info('Settings imported from file')
    await syncAllSettingsSideEffects()
    return { ok: true, settings: updated }
  } catch {
    return { ok: false, error: 'INVALID_FORMAT' as const }
  }
})

function settingsPatchValueChanged<T>(
  patchValue: T | undefined,
  before: T,
  after: T,
): boolean {
  return patchValue !== undefined && before !== after
}

function settingsPatchSectionChanged(
  patchSection: unknown,
  before: unknown,
  after: unknown,
): boolean {
  return patchSection !== undefined && JSON.stringify(before) !== JSON.stringify(after)
}

ipcMain.handle('settings:save', async (_, partial: Parameters<SettingsStore['update']>[0]) => {
  const changes = summarizeSettingsPatch(partial)
  if (Object.keys(changes).length > 0) {
    settingsLog.info('Settings updated', changes)
  }
  const settingsBefore = settingsStore.get()
  const liveBefore = isStatusBarLiveStatsEnabled()
  const batteryBefore = isStatusBarBatteryEnabled()
  const pollPriorityBefore = settingsBefore.advanced.statusBarPollPriority
  const shortcutsBefore = settingsBefore.shortcuts.global
  const screenshotEnabledBefore = settingsBefore.assistive.screenshotEnabled
  const shellContextMenuBefore = settingsBefore.advanced.shellContextMenu
  const transparencyBefore = settingsBefore.advanced.transparency
  const launchOnStartupBefore = settingsBefore.system.launchOnStartup
  const inactiveTabSleepBefore = settingsBefore.performance.inactiveTabSleep
  const themeBefore = settingsBefore.theme
  const uiStyleBefore = settingsBefore.uiStyle
  const localeBefore = settingsBefore.locale
  const proxyBefore = settingsBefore.system.proxy
  const loggingBefore = settingsBefore.logging
  const p2pBefore = settingsBefore.p2p
  const statisticsBefore = settingsBefore.statistics
  const reminderBefore = settingsBefore.reminder
  const webviewCustomHeadersBefore = settingsBefore.preview.webviewCustomHeaders

  const prevConnections = settingsBefore.connections
  const updated = settingsStore.update(partial)
  if (
    settingsPatchValueChanged(
      partial.advanced?.shellContextMenu,
      shellContextMenuBefore,
      updated.advanced.shellContextMenu,
    )
  ) {
    await syncShellContextMenuRegistry(updated.advanced.shellContextMenu)
  }
  if (partial.connections !== undefined) {
    try {
      await syncConnectionContextMenus(prevConnections, updated.connections)
    } catch (err) {
      settingsLog.error('Failed to sync connection context menus', logErrorPayload(err))
      throw err
    }
  }
  if (experimentalAiSettingsChanged(partial)) {
    try {
      await syncCopilotRuntimeFromSettings(updated.experimental)
    } catch (err) {
      copilotLog.error('Failed to sync runtime after settings save', logErrorPayload(err))
    }
  }
  if (
    (partial.advanced?.statusBarLiveStats !== undefined &&
      liveBefore !== isStatusBarLiveStatsEnabled()) ||
    (partial.advanced?.statusBarBattery !== undefined &&
      batteryBefore !== isStatusBarBatteryEnabled()) ||
    (partial.advanced?.statusBarPollPriority !== undefined &&
      pollPriorityBefore !== updated.advanced.statusBarPollPriority)
  ) {
    syncSystemStatsPolling()
  }
  if (
    settingsPatchValueChanged(
      partial.system?.launchOnStartup,
      launchOnStartupBefore,
      updated.system.launchOnStartup,
    )
  ) {
    app.setLoginItemSettings({ openAtLogin: updated.system.launchOnStartup })
  }
  const globalShortcutsChanged =
    partial.shortcuts !== undefined &&
    (shortcutsBefore.showApp !== updated.shortcuts.global.showApp ||
      shortcutsBefore.screenshot !== updated.shortcuts.global.screenshot)
  const screenshotEnabledChanged =
    partial.assistive?.screenshotEnabled !== undefined &&
    screenshotEnabledBefore !== updated.assistive.screenshotEnabled
  if (globalShortcutsChanged || screenshotEnabledChanged) {
    syncGlobalShortcuts(settingsStore, () => mainWindow)
  }
  if (
    settingsPatchValueChanged(
      partial.advanced?.transparency,
      transparencyBefore,
      updated.advanced.transparency,
    )
  ) {
    syncWindowOpacity()
  }
  if (settingsPatchSectionChanged(partial.logging, loggingBefore, updated.logging)) {
    applyLoggingSettings(updated.logging)
  }
  if (settingsPatchSectionChanged(partial.p2p, p2pBefore, updated.p2p)) {
    await syncP2PFromSettings()
  }
  if (settingsPatchValueChanged(partial.locale, localeBefore, updated.locale)) {
    void syncScreenshotsLang(updated.locale)
  }
  if (
    settingsPatchValueChanged(partial.theme, themeBefore, updated.theme) ||
    settingsPatchValueChanged(partial.uiStyle, uiStyleBefore, updated.uiStyle)
  ) {
    mainWindow?.setBackgroundColor(
      getWindowBackgroundColor(updated.theme, updated.uiStyle),
    )
  }
  if (
    settingsPatchValueChanged(
      partial.performance?.inactiveTabSleep,
      inactiveTabSleepBefore,
      updated.performance.inactiveTabSleep,
    )
  ) {
    syncInactiveTabSleepThrottling(mainWindow, updated.performance.inactiveTabSleep)
  }
  if (settingsPatchSectionChanged(partial.system?.proxy, proxyBefore, updated.system.proxy)) {
    await syncSessionProxyFromSettings()
    await syncWebviewPreviewProxy(updated.system.proxy)
  }
  if (
    settingsPatchSectionChanged(
      partial.preview?.webviewCustomHeaders,
      webviewCustomHeadersBefore,
      updated.preview.webviewCustomHeaders,
    )
  ) {
    syncWebviewPreviewCustomHeaders(updated.preview.webviewCustomHeaders)
  }
  if (settingsPatchSectionChanged(partial.statistics, statisticsBefore, updated.statistics)) {
    syncStatisticsPolling()
  }
  if (settingsPatchSectionChanged(partial.reminder, reminderBefore, updated.reminder)) {
    syncReminderScheduler()
    syncDesktopPet()
    if (
      settingsPatchValueChanged(
        partial.reminder?.desktopPetEnabled,
        reminderBefore.desktopPetEnabled,
        updated.reminder.desktopPetEnabled,
      )
    ) {
      refreshTrayMenu()
    }
  }
  if (partial.shell?.restoreTerminalSessionOnRestart === false) {
    resumeTermStore.clear()
  }
  return updated
})

ipcMain.handle('preview:clearWebviewBrowsingData', () => clearWebviewPreviewBrowsingData())

ipcMain.handle('resumeTerm:load', () => {
  terminalLog.info('[ResumeTerm] IPC load')
  return resumeTermStore.load()
})
ipcMain.handle('resumeTerm:save', (_, session: import('../shared/resume-term-session').ResumeTermSession) => {
  terminalLog.info('[ResumeTerm] IPC save', { tabCount: session?.tabs?.length ?? 0 })
  resumeTermStore.save(session)
})
ipcMain.handle('resumeTerm:clear', () => {
  terminalLog.info('[ResumeTerm] IPC clear')
  resumeTermStore.clear()
})

ipcMain.handle('app:getPendingOpenDirectory', () => takePendingOpenDirectory())
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:getRuntimeVersions', () => ({
  electron: process.versions.electron ?? '',
  chromium: process.versions.chrome ?? '',
}))
ipcMain.on('app:relaunch', () => {
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('system:getStats', () => systemStats.getCurrent())
ipcMain.handle('system:getAppMetrics', () => getAppMetricsSnapshot())
ipcMain.handle('system:reloadEnvironment', () => reloadSystemEnvironment())
ipcMain.handle('system:isProcessElevated', () => isWindowsProcessElevated())

ipcMain.handle('statistics:get', () => statisticsStore.getSnapshot())
ipcMain.on('statistics:recordTabOpen', () => statisticsStore.recordTabOpen())
ipcMain.on('statistics:recordTabClose', () => statisticsStore.recordTabClose())
ipcMain.handle('statistics:clear', () => {
  statisticsStore.clear()
})

ipcMain.handle('reminder:list', () => reminderStore.list())

ipcMain.handle('reminder:save', (_, item) => {
  if (!item || typeof item !== 'object') throw new Error('INVALID_ITEM')
  const saved = reminderStore.saveItem({
    id: typeof item.id === 'string' ? item.id : undefined,
    title: typeof item.title === 'string' ? item.title : '',
    content: typeof item.content === 'string' ? item.content : '',
    level: item.level,
    remindAt: typeof item.remindAt === 'string' ? item.remindAt : new Date().toISOString(),
    dismissed: item.dismissed === true,
    repeat: item.repeat,
    occurrenceDoneAt: item.occurrenceDoneAt ?? null,
  })
  reminderScheduler.reschedule()
  return saved
})

ipcMain.handle('reminder:delete', (_, id: string) => {
  if (typeof id !== 'string' || !id.trim()) return
  reminderStore.deleteItem(id.trim())
  reminderScheduler.reschedule()
})

ipcMain.handle('reminder:snooze', (_, ids: string[], minutes: number) => {
  if (!Array.isArray(ids)) return
  const validIds = ids.filter((id) => typeof id === 'string' && id.trim())
  const mins = typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : 0
  reminderStore.snoozeItems(validIds, mins)
  reminderScheduler.reschedule()
})

ipcMain.handle('reminder:dismiss', (_, ids: string[]) => {
  if (!Array.isArray(ids)) return
  const validIds = ids.filter((id) => typeof id === 'string' && id.trim())
  reminderStore.dismissItems(validIds)
  reminderScheduler.reschedule()
})

ipcMain.handle('reminder:clearCompleted', () => {
  const removed = reminderStore.clearCompleted()
  reminderScheduler.reschedule()
  return removed
})

ipcMain.handle('reminder:pickImage', async () => {
  const { pickAndInstallReminderImage } = await import('../reminder-image-service')
  const result = await pickAndInstallReminderImage(mainWindow)
  if (result.ok) {
    settingsStore.update({
      reminder: {
        ...settingsStore.get().reminder,
        customImageExt: result.ext,
      },
    })
  }
  return result
})

ipcMain.handle('reminder:clearImage', async () => {
  const { clearReminderImageFiles } = await import('../reminder-image-service')
  const result = await clearReminderImageFiles()
  if (result.ok) {
    settingsStore.update({
      reminder: {
        ...settingsStore.get().reminder,
        customImageExt: null,
      },
    })
  }
  return result
})

ipcMain.handle('reminder:getImageUrl', async () => {
  const { getReminderImageUrlFromExt } = await import('../reminder-image-service')
  const ext = settingsStore.get().reminder.customImageExt
  const url = getReminderImageUrlFromExt(ext)
  if (!url) return { ok: false as const, error: 'NOT_FOUND' }
  return { ok: true as const, url }
})

ipcMain.handle('reminder:listPets', async () => {
  const { listPetIds } = await import('../pet-store')
  return listPetIds()
})

ipcMain.handle('reminder:importPet', async (_, name: unknown) => {
  const { pickAndImportPet } = await import('../pet-store')
  const requestedName = typeof name === 'string' ? name : ''
  const result = await pickAndImportPet(mainWindow, requestedName)
  if (result.ok) {
    settingsStore.update({
      reminder: {
        ...settingsStore.get().reminder,
        desktopPetId: result.id,
      },
    })
    syncDesktopPet()
  }
  return result
})

ipcMain.handle('reminder:getPetPreviewUrl', async (_, petId: unknown) => {
  const { buildPetSpritesheetPreviewUrl } = await import('../pet-store')
  if (typeof petId !== 'string' || !petId.trim()) {
    return { ok: false as const, error: 'INVALID_ID' }
  }
  const url = buildPetSpritesheetPreviewUrl(petId.trim())
  if (!url) return { ok: false as const, error: 'NOT_FOUND' }
  return { ok: true as const, url }
})

ipcMain.handle('reminder:listPetAnimationStates', async (_, petId: unknown) => {
  const { listPetAnimationStates } = await import('../pet-store')
  if (typeof petId !== 'string' || !petId.trim()) return []
  return listPetAnimationStates(petId.trim())
})

ipcMain.handle('reminder:deletePet', async (_, petId: unknown) => {
  const { deletePet, listPetIds, resolveActivePetId } = await import('../pet-store')
  if (typeof petId !== 'string' || !petId.trim()) {
    return { ok: false as const, error: 'INVALID_ID' }
  }
  const id = petId.trim()
  const result = await deletePet(id)
  if (!result.ok) return result

  const reminder = settingsStore.get().reminder
  if (reminder.desktopPetId === id) {
    const remaining = await listPetIds()
    const nextId = resolveActivePetId(null, remaining)
    settingsStore.update({
      reminder: {
        ...reminder,
        desktopPetId: nextId,
      },
    })
  }
  syncDesktopPet()
  return result
})

ipcMain.handle('pet:getSpriteConfig', async () => {
  const { getDesktopPetSpriteConfig } = await import('../pet-store')
  const reminder = settingsStore.get().reminder
  return getDesktopPetSpriteConfig(
    reminder.desktopPetEnabled,
    reminder.desktopPetId,
    reminder.desktopPetAnimationState,
    reminder.desktopPetRandomState,
    reminder.desktopPetScale,
  )
})

ipcMain.handle('pet:getLabels', () => getPetUiLabels(settingsStore.get().locale))

ipcMain.handle('pet:listReminders', () => listPetReminderItems(reminderStore.list()))

ipcMain.handle('pet:dismissReminders', (_, ids: unknown) => {
  if (!Array.isArray(ids)) return
  const validIds = ids.filter((id) => typeof id === 'string' && id.trim())
  reminderStore.dismissItems(validIds)
  reminderScheduler.reschedule()
})

ipcMain.handle('pet:snoozeReminders', (_, ids: unknown, minutes: unknown) => {
  if (!Array.isArray(ids)) return
  const validIds = ids.filter((id) => typeof id === 'string' && id.trim())
  const mins = typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : 0
  reminderStore.snoozeItems(validIds, mins)
  reminderScheduler.reschedule()
})

ipcMain.handle('update:check', () => checkForAppUpdate())
ipcMain.handle('update:download', (_, payload: { version: string; downloadUrl: string }) =>
  downloadAndInstallUpdate(payload.downloadUrl, payload.version),
)

ipcMain.handle('fonts:list', () => listSystemFonts())

ipcMain.handle('connectivity:check', (_, input) => runConnectivityCheck(input))

ipcMain.handle('notes:list', () => noteStore.list())
ipcMain.handle('notes:save', (_, input) => {
  if (!input || typeof input !== 'object') throw new Error('INVALID_ITEM')
  const raw = input as { id?: unknown; title?: unknown; content?: unknown }
  return noteStore.save({
    id: typeof raw.id === 'string' ? raw.id : undefined,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
  })
})
ipcMain.handle('notes:delete', (_, id: string) => {
  if (typeof id !== 'string' || !id.trim()) return
  noteStore.delete(id.trim())
})

ipcMain.handle('repo:detectGit', () => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.detectGit()
})
ipcMain.handle('repo:pickDirectory', () => gitService.pickDirectory(mainWindow))
ipcMain.handle('repo:pickParentDirectory', () => gitService.pickParentDirectory(mainWindow))
ipcMain.handle('repo:validateRepo', (_, path: string) => gitService.validateRepo(path))
ipcMain.handle('repo:listManaged', () => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.listManaged()
})
ipcMain.handle('repo:add', (_, path: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.addRepo(path)
})
ipcMain.handle('repo:remove', (_, id: string) => gitService.removeRepo(id))
ipcMain.handle('repo:pull', (_, id: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.pull(id)
})
ipcMain.handle(
  'repo:clone',
  async (
    _,
    params: { url: string; branch: string; targetPath: string },
  ) => {
    gitService.setGitPath(settingsStore.get().filesystem.gitPath)
    return gitService.clone(params, (chunk) => {
      sendToRenderer(mainWindow, 'repo:cloneOutput', chunk)
    })
  },
)
ipcMain.handle('repo:listBranches', (_, id: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.listBranches(id)
})
ipcMain.handle('repo:checkout', (_, id: string, branch: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.checkout(id, branch)
})
ipcMain.handle('repo:getGraphCommits', (_, id: string, cursor?: import('../shared/repo-types').GitGraphCursor) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.getGraphCommits(id, cursor)
})
ipcMain.handle('repo:getCommitDetail', (_, id: string, sha: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.getCommitDetail(id, sha)
})
ipcMain.handle('repo:getCommitFileDiff', (_, id: string, sha: string, filePath: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return gitService.getCommitFileDiff(id, sha, filePath)
})
ipcMain.handle('repo:getById', (_, id: string) => gitService.getRepo(id) ?? null)

ipcMain.handle('workspace:getHomeDir', () => workspaceService.getHomeDir())
ipcMain.handle('workspace:listDir', (_, dirPath: string) => workspaceService.listDir(dirPath))
ipcMain.handle('workspace:pickDirectory', () => workspaceService.pickDirectory(mainWindow))
ipcMain.handle('workspace:detectGit', (_, workDir: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return workspaceService.detectGit(workDir)
})
ipcMain.handle('workspace:gitStatus', (_, workDir: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return workspaceService.gitStatus(workDir)
})
ipcMain.handle('workspace:gitDiff', (_, workDir: string, filePath: string) => {
  gitService.setGitPath(settingsStore.get().filesystem.gitPath)
  return workspaceService.gitDiff(workDir, filePath)
})
ipcMain.handle('workspace:listHistory', () => workspaceHistoryStore.get())
ipcMain.handle(
  'workspace:recordHistory',
  (
    _,
    input: import('../shared/workspace-history-types').WorkspaceHistoryRecordInput,
  ) => workspaceHistoryStore.record(input),
)

ipcMain.handle('session:listClaudeCodeSessions', async (_, historyPath?: string) => {
  const settings = settingsStore.get()
  const path =
    typeof historyPath === 'string' && historyPath.trim()
      ? historyPath.trim()
      : settings.session.claudeCodeHistoryPath
  return listClaudeCodeSessions(path)
})

ipcMain.handle('session:listOpenCodeSessions', async (_, dbPath?: string) => {
  const settings = settingsStore.get()
  const path =
    typeof dbPath === 'string' && dbPath.trim()
      ? dbPath.trim()
      : settings.session.openCodeDbPath
  return listOpenCodeSessions(path)
})

ipcMain.on('screenshot:open', () => {
  void openScreenshotCapture().catch((err) => {
    mainLog.error('Failed to start screenshot capture', logErrorPayload(err))
  })
})

ipcMain.on('screenshot:close', () => {
  void closeScreenshotCapture().catch((err) => {
    mainLog.error('Failed to close screenshot capture', logErrorPayload(err))
  })
})

function resolveSshProfile(
  connectionId: string,
  dynamicPasswordSuffix?: string,
): SshConnectionProfile | null {
  const conn = settingsStore.get().connections.find((c) => c.id === connectionId)
  if (!conn || conn.type !== 'ssh' || !conn.sshHost?.trim() || !conn.sshUser?.trim()) {
    scpLog('getProfile: connection not found or invalid', { connectionId })
    return null
  }
  vaultStore.load()
  const auth = inferSshAuth(conn)
  const password = resolveSshConnectionPassword(conn, (text) => vaultStore.resolveText(text), dynamicPasswordSuffix)
  const profile: SshConnectionProfile = {
    host: vaultStore.resolveText(conn.sshHost.trim()),
    user: vaultStore.resolveText(conn.sshUser.trim()),
    port: conn.sshPort ?? 22,
    keyPath:
      auth === 'publickey' && conn.sshKeyPath?.trim()
        ? vaultStore.resolveText(conn.sshKeyPath.trim())
        : undefined,
    password: password || undefined,
  }
  scpLog('getProfile', {
    connectionId,
    connectionName: conn.name,
    sshAuth: conn.sshAuth,
    ...scpProfileForLog(profile),
  })
  return profile
}

function runSshConnectionStartupScript(terminalId: string, conn: CustomConnection): void {
  const raw = conn.sshStartupScript?.trim()
  if (!raw) return
  const script = vaultStore.resolveText(raw)
  scheduleSshStartupScript((data) => terminalService.write(terminalId, data), script)
}

ipcMain.handle('rdp:connect', async (_, connectionId: string) => {
  if (process.platform !== 'win32') {
    return { ok: false as const, error: 'RDP is only supported on Windows' }
  }
  vaultStore.load()
  const conn = settingsStore.get().connections.find((c) => c.id === connectionId && c.type === 'rdp')
  if (!conn) {
    return { ok: false as const, error: 'RDP connection not found' }
  }
  return launchRdpFromConnection(conn, (text) => vaultStore.resolveText(text))
})

ipcMain.handle('putty:connect', async (_, connectionId: string) => {
  if (process.platform !== 'win32') {
    return { ok: false as const, error: 'PuTTY is only supported on Windows' }
  }
  vaultStore.load()
  const conn = settingsStore
    .get()
    .connections.find((c) => c.id === connectionId && c.type === 'putty')
  if (!conn) {
    return { ok: false as const, error: 'PuTTY connection not found' }
  }
  return launchPuttyFromConnection(conn, (text) => vaultStore.resolveText(text))
})

ipcMain.handle(
  'vnc:startProxy',
  async (
    _,
    input: {
      tabId: string
      host: string
      port: number
    },
  ): Promise<{ wsUrl: string }> => {
    if (!vncProxyManager) {
      const mod = await import('../vnc-proxy')
      vncProxyManager = new mod.VncWsProxyManager()
    }
    return vncProxyManager.start(input)
  },
)

ipcMain.handle('vnc:stopProxy', async (_, input: { tabId: string }): Promise<void> => {
  await vncProxyManager?.stop(input)
})

ipcMain.handle('ssh:checkScp', () => sshService.checkScpInPath())
ipcMain.handle('ssh:getProfile', (_, connectionId: string) => resolveSshProfile(connectionId))
ipcMain.handle('ssh:listLocal', (_, dirPath: string) => sshService.listLocalDirectory(dirPath))
ipcMain.handle('fs:listRoots', () => sshService.listFilesystemRoots())
ipcMain.handle('fs:listFavorites', () => filesystemFavoritesStore.get())
ipcMain.handle('fs:addFavorite', async (_, path: string) =>
  filesystemFavoritesStore.add(path),
)
ipcMain.handle('fs:removeFavorite', (_, id: string) => ({
  ok: filesystemFavoritesStore.remove(id),
}))
ipcMain.handle('fs:getImagePreviewUrl', (_, filePath: string) =>
  fsService.getImagePreviewUrl(filePath),
)
ipcMain.handle(
  'fs:getTerminalFilePreviewUrl',
  (_, filePath: string, kind: import('../shared/terminal-preview-files').TerminalPreviewFileKind) =>
    fsService.getTerminalFilePreviewUrl(filePath, kind),
)

ipcMain.on(
  'preview:openLink',
  (_, tabId: string, url: string, bounds?: import('../link-preview-manager').LinkPreviewBounds) => {
    getLinkPreviewManager().open(tabId, url, bounds)
  },
)
ipcMain.on(
  'preview:setBounds',
  (_, tabId: string, bounds: import('../link-preview-manager').LinkPreviewBounds) => {
    getLinkPreviewManager().setBounds(tabId, bounds)
  },
)
ipcMain.on('preview:setVisible', (_, tabId: string, visible: boolean) => {
  getLinkPreviewManager().setVisible(tabId, visible)
})
ipcMain.on('preview:close', (_, tabId: string) => {
  getLinkPreviewManager().close(tabId)
})
ipcMain.on('preview:setOverlaySuppressed', (_, suppressed: boolean) => {
  getLinkPreviewManager().setOverlaySuppressed(suppressed === true)
})
ipcMain.handle(
  'fs:detectProgram',
  (_, options: { kind: 'vscode' | 'cursor' | 'custom'; path?: string }) =>
    fsService.detectProgram(options.kind, options.path),
)
ipcMain.handle('fs:openWithProgram', (_, programPath: string, targetPath: string) =>
  fsService.openWithProgram(programPath, targetPath),
)
ipcMain.handle('fs:resolveTerminalDropDirectory', (_, filePath: string) =>
  fsService.resolveTerminalDropDirectory(filePath),
)
const SSH_PROFILE_NOT_FOUND = { ok: false as const, error: '无法解析 SSH 连接配置' }

ipcMain.handle(
  'ssh:listRemote',
  (
    _,
    connectionId: string,
    remotePath: string,
    options?: import('../shared/ssh-types').ScpListRemoteOptions,
  ) => {
    const profile = resolveSshProfile(connectionId)
    if (!profile) return SSH_PROFILE_NOT_FOUND
    scpLog('ipc listRemote', {
      connectionId,
      remotePath,
      afterTransfer: Boolean(options?.afterTransfer),
      ...scpProfileForLog(profile),
    })
    const sshOpts = settingsStore.get().ssh
    const enabledKex = sshOpts.enabledKexAlgorithms
    const connectTimeoutSeconds = sshOpts.connectTimeoutSeconds
    return sshService.listRemoteDirectoryWithRetry(
      profile,
      remotePath,
      options,
      enabledKex,
      connectTimeoutSeconds,
    )
  },
)
ipcMain.handle(
  'ssh:upload',
  async (event, connectionId: string, localPath: string, remotePath: string) => {
    const profile = resolveSshProfile(connectionId)
    if (!profile) return SSH_PROFILE_NOT_FOUND
    scpLog('ipc upload', { connectionId, localPath, remotePath, ...scpProfileForLog(profile) })
    const sendProgress = (progress: ScpTransferProgress) => {
      event.sender.send('ssh:transferProgress', progress)
    }
    const sshOpts = settingsStore.get().ssh
    return sshService.scpUpload(
      profile,
      localPath,
      remotePath,
      sendProgress,
      sshOpts.enabledKexAlgorithms,
      sshOpts.connectTimeoutSeconds,
    )
  },
)
ipcMain.handle(
  'ssh:download',
  async (event, connectionId: string, remotePath: string, localPath: string) => {
    const profile = resolveSshProfile(connectionId)
    if (!profile) return SSH_PROFILE_NOT_FOUND
    scpLog('ipc download', { connectionId, remotePath, localPath, ...scpProfileForLog(profile) })
    const sendProgress = (progress: ScpTransferProgress) => {
      event.sender.send('ssh:transferProgress', progress)
    }
    const sshOpts = settingsStore.get().ssh
    return sshService.scpDownload(
      profile,
      remotePath,
      localPath,
      sendProgress,
      sshOpts.enabledKexAlgorithms,
      sshOpts.connectTimeoutSeconds,
    )
  },
)

ipcMain.handle('terminal:create', async (_, options: TerminalCreateOptions) => {
  vaultStore.load()
  terminalLog.info('Create terminal requested', {
    shell: options.shell,
    name: options.name,
    sshConnectionId: options.sshConnectionId,
    elevated: options.elevated === true,
  })
  let resolved: TerminalCreateOptions = {
    ...options,
    command: options.command ? vaultStore.resolveText(options.command) : undefined,
    args: options.args?.map((arg: string) => vaultStore.resolveText(arg)),
    env: options.env ? await vaultStore.resolveEnv(options.env) : undefined,
  }
  let sshConn: CustomConnection | undefined
  if (options.sshConnectionId) {
    const conn = settingsStore
      .get()
      .connections.find((c) => c.id === options.sshConnectionId && c.type === 'ssh')
    if (conn) {
      sshConn = conn
      const sshSettings = settingsStore.get().ssh
      if (sshSettings.useBuiltinSsh2) {
        const profile = resolveSshProfile(options.sshConnectionId, options.sshDynamicPasswordSuffix)
        if (!profile) {
          throw new Error('无法解析 SSH 连接配置')
        }
        try {
          const session = await terminalService.createSsh2({
            profile,
            enabledKex: sshSettings.enabledKexAlgorithms,
            connectTimeoutSeconds: sshSettings.connectTimeoutSeconds,
            name: conn.name,
            cols: options.cols,
            rows: options.rows,
          })
          runSshConnectionStartupScript(session.id, conn)
          terminalLog.info('Terminal created (ssh2)', {
            id: session.id,
            shell: session.shell,
            name: session.name,
            cwd: session.cwd,
          })
          return session
        } catch (err) {
          terminalLog.error('ssh2 terminal create failed', logErrorPayload(err))
          throw err
        }
      }
      resolved = applySshConnectionToTerminalOptions(
        resolved,
        conn,
        (text) => vaultStore.resolveText(text),
        options.sshDynamicPasswordSuffix,
        sshSettings.connectTimeoutSeconds,
      )
    }
  }
  try {
    const shellSettings = settingsStore.get().shell
    const appSettings = settingsStore.get()
    const terminalImageProtocol = resolveTerminalImageProtocolFromSettings(
      shellSettings,
      appSettings.experimental,
    )
    const terminalEmulator = normalizeTerminalEmulator(appSettings.experimental.terminalEmulator)
    const session = terminalService.create({
      ...resolved,
      ohMyPoshEnabled: shellSettings.ohMyPoshEnabled,
      ohMyPoshTheme: shellSettings.ohMyPoshTheme,
      terminalImageProtocol,
      terminalEmulator,
    })
    if (sshConn) {
      runSshConnectionStartupScript(session.id, sshConn)
    }
    terminalLog.info('Terminal created', {
      id: session.id,
      shell: session.shell,
      name: session.name,
      cwd: session.cwd,
    })
    return session
  } catch (err) {
    terminalLog.error('Terminal create failed', logErrorPayload(err))
    throw err
  }
})

ipcMain.handle('vault:list', () => vaultStore.load())
ipcMain.handle('vault:getKeys', () => vaultStore.getKeys())
ipcMain.handle('vault:save', async (_, input) => {
  vaultStore.load()
  const saved = vaultStore.save(input)
  try {
    await syncCopilotRuntimeIfAiApiKeyUsesVault()
  } catch (err) {
    copilotLog.error('Failed to sync runtime after vault save', logErrorPayload(err))
  }
  vaultLog.info('Vault variable saved', { id: saved.id, key: saved.key })
  return saved
})
ipcMain.handle('vault:remove', async (_, id: string) => {
  vaultStore.load()
  vaultStore.remove(id)
  vaultLog.info('Vault variable removed', { id })
  try {
    await syncCopilotRuntimeIfAiApiKeyUsesVault()
  } catch (err) {
    copilotLog.error('Failed to sync runtime after vault remove', logErrorPayload(err))
  }
})
ipcMain.handle('vault:resolve', (_, text: string) => {
  vaultStore.load()
  return vaultStore.resolveText(text)
})
ipcMain.handle('vault:resolveBatch', async (_, texts: string[]) => {
  vaultStore.load()
  return vaultStore.resolveTexts(texts)
})
ipcMain.on('terminal:write', (_, id: string, data: string) => {
  statisticsStore.recordCommandFromTerminalWrite(data)
  terminalService.write(id, data)
})
ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) =>
  terminalService.resize(id, cols, rows),
)
ipcMain.on('terminal:kill', (_, id: string) => terminalKillQueue.enqueue(id))
ipcMain.handle('terminal:isAlive', (_, id: string) => terminalService.isAlive(id))
ipcMain.on('terminal:setActiveStream', (_, id: string | null) => {
  terminalService.setActiveStream(id)
})
ipcMain.on('terminal:setActiveStreams', (_, ids: string[]) => {
  terminalService.setActiveStreams(ids)
})
ipcMain.handle('terminal:claimStream', (_, id: string) => terminalService.claimStream(id))
ipcMain.on('terminal:ackData', (_, id: string, length: number) => {
  terminalService.ackActiveOutput(id, length)
})

terminalService.on('data', (id, data) => {
  terminalOutputFlusher.queue(id, data)
})
terminalService.on('exit', (id, code) => {
  terminalLog.info('Terminal exited', { id, code })
  sendToRenderer(mainWindow, 'terminal:exit', id, code)
})
terminalService.on('cwd', (id, cwd) => {
  sendToRenderer(mainWindow, 'terminal:cwd', id, cwd)
})
