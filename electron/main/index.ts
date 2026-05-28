import '../copilot-telemetry-env'
import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  dialog,
  clipboard,
  nativeImage,
  screen,
} from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'node:url'
import { TerminalService } from '../terminal-service'
import { SettingsStore, isHardwareAccelerationEnabled } from '../settings-store'
import { SystemStats } from '../system-stats'
import { getAppMetricsSnapshot } from '../app-metrics'
import { VaultStore } from '../vault-store'
import { listSystemFonts } from '../font-store'
import { syncGlobalShortcuts, unregisterGlobalShortcuts } from '../global-shortcuts'
import { sendToRenderer } from './window-ipc'
import { createTerminalOutputFlusher } from './terminal-output-flush'
import { augmentWindowsPath } from '../resolve-executable'
import { loadTrayIcon } from '../tray-icon'
import { CopilotRuntimeServer } from '../copilot-runtime-server'
import { buildAiRuntimeConfig } from '../shared/experimental-settings'
import {
  applyChromiumPerformanceFlags,
  getOptimizedWebPreferences,
  syncInactiveTabSleepThrottling,
} from '../chromium-tuning'
import { readPerformanceSettingsFromDisk } from '../performance-settings-disk'
import { configureSessionPrivacy, disableCrashReporting } from '../session-privacy'
import {
  flushPendingOpenDirectory,
  parseDirectoryFromArgv,
  queueOpenDirectory,
  setInitialOpenDirectoryFromArgv,
  takePendingOpenDirectory,
} from '../open-directory'
import {
  isWindowsShellContextMenuSupported,
  setWindowsShellContextMenu,
} from '../windows-shell-context-menu'
import { scpLog, scpProfileForLog } from '../scp-logger'
import type { SshConnectionProfile, TerminalCreateOptions } from '../shared/api-types'
import type { ScpTransferProgress } from '../shared/ssh-types'
import * as sshService from '../ssh-service'
import * as fsService from '../fs-service'
import { captureWindowState, getInitialWindowOptions } from '../window-bounds'
import { reloadSystemEnvironment } from '../reload-system-env'
import { isWindowsProcessElevated } from '../windows-admin'
import { checkForAppUpdate, downloadAndInstallUpdate } from '../app-update'
import { inferSshAuth } from '../ssh-auth'
import { applySshConnectionToTerminalOptions } from '../ssh-terminal-spawn'
import { getWindowBackgroundColor } from '../shared/ui-style'
import { isElectronDev } from '../shared/is-dev'
import { installReleaseDevToolsGuard } from '../shared/release-devtools-guard'
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
import { buildInitialSettingsArgv } from '../shared/initial-settings'
import { setDebugLogEnabled } from '../debug-log'
import { isDebugLogEnabled } from '../debug-log'

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
  app.quit()
}

if (!isHardwareAccelerationEnabled()) {
  app.disableHardwareAcceleration()
}

disableCrashReporting()
const performanceSettingsAtLaunch = readPerformanceSettingsFromDisk()
applyChromiumPerformanceFlags({
  inactiveTabSleep: performanceSettingsAtLaunch.inactiveTabSleep,
})
installReleaseDevToolsGuard()

let mainWindow: BrowserWindow | null = null
let screenshotWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let linkPreviewManager: LinkPreviewManager | null = null

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

async function syncAllSettingsSideEffects(): Promise<void> {
  const updated = settingsStore.get()
  await syncShellContextMenuRegistry(updated.advanced.shellContextMenu)
  app.setLoginItemSettings({ openAtLogin: updated.system.launchOnStartup })
  syncGlobalShortcuts(settingsStore, () => mainWindow)
  syncWindowOpacity()
  setDebugLogEnabled(updated.advanced.debugLog === true)
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
const vaultStore = new VaultStore()
const systemStats = new SystemStats()
const copilotRuntimeServer = new CopilotRuntimeServer()

function syncCopilotRuntimeFromSettings(experimental = settingsStore.get().experimental): void {
  void copilotRuntimeServer
    .sync(buildAiRuntimeConfig(experimental))
    .catch((err) => console.error('[NioZy] Failed to sync copilot runtime:', err))
}

function experimentalAiSettingsChanged(partial: Parameters<SettingsStore['update']>[0]): boolean {
  if (!partial.experimental) return false
  const keys = ['aiSidebarEnabled', 'aiRuntimePort', 'aiProvider', 'aiModel', 'aiBaseUrl', 'aiApiKey', 'openAiApiKey'] as const
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

function handleOpenDirectoryRequest(directory: string): void {
  showMainWindow()
  queueOpenDirectory(mainWindow, directory)
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

  if (isDev) {
    console.log('[NioZy] preload script:', preloadPath, existsSync(preloadPath))
  }

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

  mainWindow.webContents.on('preload-error', (_, path, error) => {
    console.error('[NioZy] Failed to load preload:', path, error)
  })

  syncInactiveTabSleepThrottling(mainWindow, settings.performance.inactiveTabSleep)

  mainWindow.on('ready-to-show', () => {
    syncWindowOpacity()
    if (initialBounds.startMaximized) {
      mainWindow?.maximize()
    }
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

function getRendererUrlForHash(hash: string): string {
  const baseUrl = process.env['ELECTRON_RENDERER_URL']
  if (baseUrl) {
    const h = hash.startsWith('#') ? hash : `#${hash}`
    return `${baseUrl}${h}`
  }
  // production: loadFile -> pass hash via URL when calling loadURL, else it is lost
  return `file://${join(__dirname, '../renderer/index.html')}${hash.startsWith('#') ? hash : `#${hash}`}`
}

function resolveRendererIndexHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

function createScreenshotWindow(): void {
  if (screenshotWindow && !screenshotWindow.isDestroyed()) {
    screenshotWindow.show()
    screenshotWindow.focus()
    return
  }

  const preloadPath = resolvePreloadPath()
  const display = screen.getPrimaryDisplay()
  const bounds = display.bounds

  screenshotWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    skipTaskbar: true,
    title: '截图',
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath,
      // 截图依赖 desktopCapturer；在 renderer sandbox 下可能不可用
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      devTools: isDev,
      spellcheck: false,
      backgroundThrottling: false,
      navigateOnDragDrop: false,
      autoplayPolicy: 'document-user-activation-required',
      enableWebSQL: false,
    },
  })

  screenshotWindow.webContents.on('console-message', (_event, level, message) => {
    // 方便定位截图窗口白屏/加载中问题
    const levels = ['log', 'warn', 'error']
    const tag = levels[level] ?? String(level)
    if (isDev || isDebugLogEnabled()) {
      console.log(`[screenshot-window:${tag}]`, message)
    }
  })

  screenshotWindow.on('ready-to-show', () => {
    try {
      screenshotWindow?.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      // ignore
    }
    screenshotWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    screenshotWindow?.setFullScreen(true)
    screenshotWindow?.show()
    screenshotWindow?.focus()
  })

  screenshotWindow.on('closed', () => {
    screenshotWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    screenshotWindow.loadURL(getRendererUrlForHash('#/screenshot'))
  } else {
    // For file:// we need to load the index.html first, hash is embedded in URL
    screenshotWindow.loadURL(getRendererUrlForHash('#/screenshot'))
    // Fallback: if loadURL fails for file protocol, try loadFile without hash
    // (hash-less will just show main app)
    screenshotWindow.webContents.on('did-fail-load', () => {
      try {
        void screenshotWindow?.loadFile(resolveRendererIndexHtmlPath())
      } catch {
        /* ignore */
      }
    })
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
    if (directory) handleOpenDirectoryRequest(directory)
    else showMainWindow()
  })
}

app.whenReady().then(async () => {
  configureSessionPrivacy()
  await registerLocalFileProtocolHandler()

  settingsStore.load()
  vaultStore.load()
  void syncCopilotRuntimeFromSettings()
  setDebugLogEnabled(settingsStore.get().advanced.debugLog === true)
  await syncSessionProxyFromSettings()
  initWebviewPreviewSession()
  await syncWebviewPreviewFromSettings()
  linkPreviewManager = new LinkPreviewManager(
    () => mainWindow,
    settingsStore.get().advanced.disableSandbox,
  )

  if (isDev) {
    console.log('[NioZy] app path:', app.getAppPath())
    console.log('[NioZy] main dir:', __dirname)
  }

  createWindow()
  createTray()
  syncSystemStatsPolling()
  syncGlobalShortcuts(settingsStore, () => mainWindow)

  if (settingsStore.get().advanced.shellContextMenu) {
    void syncShellContextMenuRegistry(true).catch((err) => {
      console.error('[NioZy] Failed to sync shell context menu registry:', err)
    })
  }

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
  persistWindowBoundsIfEnabled()
  linkPreviewManager?.closeAll()
  terminalOutputFlusher.dispose()
  terminalService.disposeAll()
  unregisterGlobalShortcuts()
  systemStats.stop()
  void copilotRuntimeServer
    .stop(true)
    .catch((err) => console.error('[NioZy] Failed to stop copilot runtime:', err))
})

app.on('will-quit', () => {
  unregisterGlobalShortcuts()
})

ipcMain.on('window:minimize', () => mainWindow?.minimize())
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
ipcMain.handle('copilot:getRuntimeUrl', () => copilotRuntimeServer.getRuntimeUrl())

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
    await syncAllSettingsSideEffects()
    return { ok: true, settings: updated }
  } catch {
    return { ok: false, error: 'INVALID_FORMAT' as const }
  }
})

ipcMain.handle('settings:save', async (_, partial: Parameters<SettingsStore['update']>[0]) => {
  const liveBefore = isStatusBarLiveStatsEnabled()
  const shortcutBefore = settingsStore.get().shortcuts.global.showApp
  if (partial.advanced?.shellContextMenu !== undefined) {
    await syncShellContextMenuRegistry(partial.advanced.shellContextMenu)
  }

  const updated = settingsStore.update(partial)
  if (experimentalAiSettingsChanged(partial)) {
    syncCopilotRuntimeFromSettings(updated.experimental)
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
  if (partial.advanced?.debugLog !== undefined) {
    setDebugLogEnabled(updated.advanced.debugLog === true)
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

ipcMain.handle('update:check', () => checkForAppUpdate())
ipcMain.handle('update:download', (_, payload: { version: string; downloadUrl: string }) =>
  downloadAndInstallUpdate(payload.downloadUrl, payload.version),
)

ipcMain.handle('fonts:list', () => listSystemFonts())

ipcMain.on('screenshot:open', () => {
  createScreenshotWindow()
})

ipcMain.on('screenshot:close', () => {
  if (!screenshotWindow || screenshotWindow.isDestroyed()) return
  screenshotWindow.close()
})

ipcMain.on('screenshot:enterEditMode', () => {
  const win = screenshotWindow && !screenshotWindow.isDestroyed() ? screenshotWindow : null
  if (!win) return
  try {
    if (win.isFullScreen()) win.setFullScreen(false)
  } catch {
    // ignore
  }
  try {
    win.setResizable(true)
    win.setMovable(true)
    win.setMinimumSize(900, 600)
  } catch {
    // ignore
  }
  try {
    const area = screen.getPrimaryDisplay().workArea
    const width = Math.min(980, area.width)
    const height = Math.min(720, area.height)
    const x = Math.round(area.x + (area.width - width) / 2)
    const y = Math.round(area.y + (area.height - height) / 2)
    win.setBounds({ x, y, width, height })
  } catch {
    // ignore
  }
})

ipcMain.handle('screenshot:captureScreen', async () => {
  // 使用主进程抓屏，避免 renderer desktopCapturer 不可用的问题
  const mod = (await import('screenshot-desktop')) as unknown as {
    default?: (options?: { format?: 'png' | 'jpg'; screen?: number }) => Promise<Buffer> | Promise<Buffer[]>
  }
  const screenshotDesktop = mod.default
  if (!screenshotDesktop) {
    return { ok: false as const, error: 'SCREENSHOT_DESKTOP_UNAVAILABLE' }
  }

  try {
    // 关键：抓屏前隐藏截图窗口，避免把自身（白屏遮罩）截进去
    const win = screenshotWindow && !screenshotWindow.isDestroyed() ? screenshotWindow : null
    const wasVisible = win?.isVisible() ?? false
    if (win && wasVisible) {
      try {
        win.setOpacity(0)
        win.hide()
      } catch {
        // ignore
      }
      // 给系统一点时间完成窗口隐藏/合成
      await new Promise((r) => setTimeout(r, 120))
    }

    const result = await screenshotDesktop({ format: 'png' })
    const buf = Array.isArray(result) ? result[0] : result
    if (!buf) return { ok: false as const, error: 'NO_SCREENSHOT_BUFFER' }
    const img = nativeImage.createFromBuffer(buf)
    const size = img.getSize()

    if (win && wasVisible) {
      try {
        win.showInactive()
        win.setOpacity(1)
        win.focus()
      } catch {
        // ignore
      }
    }

    return {
      ok: true as const,
      dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
      width: size.width,
      height: size.height,
    }
  } catch (err) {
    // 尝试恢复窗口显示，避免“截屏失败后窗口消失”
    try {
      if (screenshotWindow && !screenshotWindow.isDestroyed()) {
        screenshotWindow.show()
        screenshotWindow.setOpacity(1)
      }
    } catch {
      // ignore
    }
    return { ok: false as const, error: err instanceof Error ? err.message : 'CAPTURE_FAILED' }
  }
})

ipcMain.handle(
  'screenshot:savePng',
  async (_, payload: { dataUrl: string; defaultFileName?: string }) => {
    const date = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
      date.getHours(),
    )}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    const defaultName = payload.defaultFileName?.trim() || `screenshot-${stamp}.png`

    const saveOptions = {
      title: '保存截图',
      defaultPath: defaultName,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    }

    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (canceled || !filePath) return { ok: false, canceled: true }

    try {
      const img = nativeImage.createFromDataURL(payload.dataUrl)
      const buf = img.toPNG()
      await writeFile(filePath, buf)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'WRITE_FAILED' }
    }
  },
)

ipcMain.handle('screenshot:copyToClipboard', async (_, payload: { dataUrl: string }) => {
  try {
    const img = nativeImage.createFromDataURL(payload.dataUrl)
    clipboard.writeImage(img)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'COPY_FAILED' }
  }
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
    return sshService.listRemoteDirectoryWithRetry(profile, remotePath, options)
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
    return sshService.scpUpload(profile, localPath, remotePath, sendProgress)
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
    return sshService.scpDownload(profile, remotePath, localPath, sendProgress)
  },
)

ipcMain.handle('terminal:create', (_, options: TerminalCreateOptions) => {
  vaultStore.load()
  let resolved: TerminalCreateOptions = {
    ...options,
    command: options.command ? vaultStore.resolveText(options.command) : undefined,
    args: options.args?.map((arg: string) => vaultStore.resolveText(arg)),
    env: options.env ? vaultStore.resolveEnv(options.env) : undefined,
  }
  if (options.sshConnectionId) {
    const conn = settingsStore
      .get()
      .connections.find((c) => c.id === options.sshConnectionId && c.type === 'ssh')
    if (conn) {
      resolved = applySshConnectionToTerminalOptions(resolved, conn, (text) =>
        vaultStore.resolveText(text),
      )
    }
  }
  return terminalService.create(resolved)
})

ipcMain.handle('vault:list', () => vaultStore.load())
ipcMain.handle('vault:getKeys', () => vaultStore.getKeys())
ipcMain.handle('vault:save', (_, input) => {
  vaultStore.load()
  return vaultStore.save(input)
})
ipcMain.handle('vault:remove', (_, id: string) => {
  vaultStore.load()
  vaultStore.remove(id)
})
ipcMain.handle('vault:resolve', (_, text: string) => {
  vaultStore.load()
  return vaultStore.resolveText(text)
})
ipcMain.on('terminal:write', (_, id: string, data: string) => terminalService.write(id, data))
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
  sendToRenderer(mainWindow, 'terminal:exit', id, code)
})
terminalService.on('cwd', (id, cwd) => {
  sendToRenderer(mainWindow, 'terminal:cwd', id, cwd)
})
