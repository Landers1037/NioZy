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
import { ReminderStore } from '../reminder-store'
import { ReminderScheduler } from '../reminder-scheduler'
import { SystemStats } from '../system-stats'
import { getAppMetricsSnapshot } from '../app-metrics'
import { VaultStore } from '../vault-store'
import { listSystemFonts } from '../font-store'
import { syncGlobalShortcuts, unregisterGlobalShortcuts } from '../global-shortcuts'
import { sendToRenderer } from './window-ipc'
import { createTerminalOutputFlusher } from './terminal-output-flush'
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
  parseDirectoryFromArgv,
  parseConnectionIdFromArgv,
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
import type { SshConnectionProfile, TerminalCreateOptions, CustomConnection } from '../shared/api-types'
import type { ScpTransferProgress } from '../shared/ssh-types'
import * as sshService from '../ssh-service'
import * as fsService from '../fs-service'
import { captureWindowState, getInitialWindowOptions } from '../window-bounds'
import { reloadSystemEnvironment } from '../reload-system-env'
import { isWindowsProcessElevated } from '../windows-admin'
import { checkForAppUpdate, downloadAndInstallUpdate } from '../app-update'
import { inferSshAuth } from '../ssh-auth'
import { applySshConnectionToTerminalOptions } from '../ssh-terminal-spawn'
import { scheduleSshStartupScript } from '../ssh-startup-script'
import { launchRdpFromConnection } from '../rdp-launch'
import { launchPuttyFromConnection } from '../putty-launch'
import { runConnectivityCheck } from '../connectivity-check-service'
import { GitService } from '../git-service'
import { getWindowBackgroundColor } from '../shared/ui-style'
import { isElectronDev } from '../shared/is-dev'
import { installReleaseDevToolsGuard } from '../shared/release-devtools-guard'
import { NoteStore } from '../note-store'
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
const terminalOutputFlusher = createTerminalOutputFlusher(() => mainWindow)
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
const systemStats = new SystemStats()
const noteStore = new NoteStore()

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

function syncSystemStatsPolling(): void {
  systemStats.stop()
  if (!isStatusBarLiveStatsEnabled()) return
  systemStats.start((stats) => {
    sendToRenderer(mainWindow, 'system:stats', stats)
  })
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

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function requestNewTerminalFromTray(): void {
  showMainWindow()
  sendToRenderer(mainWindow, 'app:newTerminal')
}

function requestOpenSettingsFromTray(): void {
  showMainWindow()
  sendToRenderer(mainWindow, 'app:openSettings')
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
    }
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
  const contextMenu = Menu.buildFromTemplate([
    { label: '新建终端', click: () => requestNewTerminalFromTray() },
    { label: '打开设置', click: () => requestOpenSettingsFromTray() },
    { type: 'separator' },
    { label: '显示 NioZy', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => showMainWindow())
}

if (gotSingleInstanceLock) {
  app.on('second-instance', (_event, argv) => {
    const directory = parseDirectoryFromArgv(argv)
    const connectionId = parseConnectionIdFromArgv(argv)
    mainLog.info('Second instance', {
      directory: directory ?? null,
      connectionId: connectionId ?? null,
    })
    if (directory) handleOpenDirectoryRequest(directory, connectionId)
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
  })
  syncDesktopPet()
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
    if (!s.system.minimizeToTrayOnClose) app.quit()
  }
})

app.on('before-quit', () => {
  mainLog.info('Application quitting')
  persistWindowBoundsIfEnabled()
  linkPreviewManager?.closeAll()
  terminalOutputFlusher.dispose()
  terminalService.disposeAll()
  void vncProxyManager?.disposeAll()
  unregisterGlobalShortcuts()
  void disposeScreenshotsService()
  disposeDesktopPet()
  systemStats.stop()
  statisticsStore.dispose()
  void disposeCopilotRuntime(true).catch((err) =>
    copilotLog.error('Failed to stop runtime', logErrorPayload(err)),
  )
  void p2pService.stop()
})

app.on('will-quit', () => {
  unregisterGlobalShortcuts()
})

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('pet:ready', () => onPetReady())
ipcMain.on('pet:pointerDown', (_, x: number, y: number) => {
  if (typeof x === 'number' && typeof y === 'number') onPetPointerDown(x, y)
})
ipcMain.on('pet:pointerMove', (_, x: number, y: number) => {
  if (typeof x === 'number' && typeof y === 'number') onPetPointerMove(x, y)
})
ipcMain.on('pet:pointerUp', (_, x: number, y: number) => {
  if (typeof x === 'number' && typeof y === 'number') onPetPointerUp(x, y)
})
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
  const { buildTerminalBackgroundPreviewUrl, terminalBackgroundExists } = await import(
    '../terminal-background-service'
  )
  const normalized = typeof ext === 'string' ? ext.replace(/^\./, '').toLowerCase() : ''
  if (!normalized || !terminalBackgroundExists(normalized)) {
    return { ok: false as const, error: 'NOT_FOUND' }
  }
  return { ok: true as const, url: buildTerminalBackgroundPreviewUrl(normalized) }
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

ipcMain.handle('settings:get', () => settingsStore.get())
ipcMain.handle('copilot:getRuntimeUrl', () => getCopilotRuntimeUrl())

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
  let parsed: unknown
  try {
    const content = await readFile(filePaths[0], 'utf8')
    parsed = JSON.parse(content) as unknown
  } catch (err) {
    if (err instanceof SyntaxError) return { ok: false, error: 'INVALID_JSON' as const }
    return { ok: false, error: 'READ_FAILED' as const }
  }
  try {
    const updated = settingsStore.importFromExport(parsed)
    settingsLog.info('Settings imported from file')
    await syncAllSettingsSideEffects()
    return { ok: true, settings: updated }
  } catch {
    return { ok: false, error: 'INVALID_FORMAT' as const }
  }
})

ipcMain.handle('settings:save', async (_, partial: Parameters<SettingsStore['update']>[0]) => {
  const changes = summarizeSettingsPatch(partial)
  if (Object.keys(changes).length > 0) {
    settingsLog.info('Settings updated', changes)
  }
  const liveBefore = isStatusBarLiveStatsEnabled()
  const shortcutBefore = settingsStore.get().shortcuts.global.showApp
  if (partial.advanced?.shellContextMenu !== undefined) {
    await syncShellContextMenuRegistry(partial.advanced.shellContextMenu)
  }

  const prevConnections = settingsStore.get().connections
  const updated = settingsStore.update(partial)
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
  if (partial.advanced?.statusBarLiveStats !== undefined && liveBefore !== isStatusBarLiveStatsEnabled()) {
    syncSystemStatsPolling()
  }
  if (partial.system?.launchOnStartup !== undefined) {
    app.setLoginItemSettings({ openAtLogin: updated.system.launchOnStartup })
  }
  if (
    partial.shortcuts !== undefined &&
    shortcutBefore !== updated.shortcuts.global.showApp
  ) {
    syncGlobalShortcuts(settingsStore, () => mainWindow)
  }
  if (partial.advanced?.transparency !== undefined) {
    syncWindowOpacity()
  }
  if (partial.logging !== undefined) {
    applyLoggingSettings(updated.logging)
  }
  if (partial.p2p !== undefined) {
    await syncP2PFromSettings()
  }
  if (partial.locale !== undefined) {
    void syncScreenshotsLang(updated.locale)
  }
  if (partial.theme !== undefined || partial.uiStyle !== undefined) {
    mainWindow?.setBackgroundColor(
      getWindowBackgroundColor(updated.theme, updated.uiStyle),
    )
  }
  if (partial.performance?.inactiveTabSleep !== undefined) {
    syncInactiveTabSleepThrottling(mainWindow, updated.performance.inactiveTabSleep)
  }
  if (partial.system?.proxy !== undefined) {
    await syncSessionProxyFromSettings()
    await syncWebviewPreviewProxy(updated.system.proxy)
  }
  if (partial.preview?.webviewCustomHeaders !== undefined) {
    syncWebviewPreviewCustomHeaders(updated.preview.webviewCustomHeaders)
  }
  if (partial.statistics !== undefined) {
    syncStatisticsPolling()
  }
  if (partial.reminder !== undefined) {
    syncReminderScheduler()
    syncDesktopPet()
  }
  return updated
})

ipcMain.handle('preview:clearWebviewBrowsingData', () => clearWebviewPreviewBrowsingData())

ipcMain.handle('app:getPendingOpenDirectory', () => takePendingOpenDirectory())
ipcMain.handle('app:getVersion', () => app.getVersion())
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

function resolveSshProfile(connectionId: string): SshConnectionProfile | null {
  const conn = settingsStore.get().connections.find((c) => c.id === connectionId)
  if (!conn || conn.type !== 'ssh' || !conn.sshHost?.trim() || !conn.sshUser?.trim()) {
    scpLog('getProfile: connection not found or invalid', { connectionId })
    return null
  }
  vaultStore.load()
  const auth = inferSshAuth(conn)
  const password =
    auth === 'password' && conn.sshPassword?.trim()
      ? vaultStore.resolveText(conn.sshPassword.trim())
      : undefined
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
    const enabledKex = settingsStore.get().ssh.enabledKexAlgorithms
    return sshService.listRemoteDirectoryWithRetry(profile, remotePath, options, enabledKex)
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
    const enabledKex = settingsStore.get().ssh.enabledKexAlgorithms
    return sshService.scpUpload(profile, localPath, remotePath, sendProgress, enabledKex)
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
    const enabledKex = settingsStore.get().ssh.enabledKexAlgorithms
    return sshService.scpDownload(profile, remotePath, localPath, sendProgress, enabledKex)
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
    env: options.env ? vaultStore.resolveEnv(options.env) : undefined,
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
        const profile = resolveSshProfile(options.sshConnectionId)
        if (!profile) {
          throw new Error('无法解析 SSH 连接配置')
        }
        try {
          const session = await terminalService.createSsh2({
            profile,
            enabledKex: sshSettings.enabledKexAlgorithms,
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
      resolved = applySshConnectionToTerminalOptions(resolved, conn, (text) =>
        vaultStore.resolveText(text),
      )
    }
  }
  try {
    const session = terminalService.create(resolved)
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
ipcMain.on('terminal:write', (_, id: string, data: string) => {
  statisticsStore.recordCommandFromTerminalWrite(data)
  terminalService.write(id, data)
})
ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) =>
  terminalService.resize(id, cols, rows),
)
ipcMain.on('terminal:kill', (_, id: string) => terminalService.kill(id))
ipcMain.on('terminal:setActiveStream', (_, id: string | null) => {
  terminalService.setActiveStream(id)
})
ipcMain.on('terminal:setActiveStreams', (_, ids: string[]) => {
  terminalService.setActiveStreams(ids)
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
