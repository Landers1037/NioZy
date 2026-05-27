import { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
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
let tray: Tray | null = null
let isQuitting = false
let linkPreviewManager: LinkPreviewManager | null = null

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

const isDev = isElectronDev()

const terminalService = new TerminalService()
const terminalOutputFlusher = createTerminalOutputFlusher(() => mainWindow)
const settingsStore = new SettingsStore()
const vaultStore = new VaultStore()
const systemStats = new SystemStats()

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
ipcMain.handle('settings:save', async (_, partial: Parameters<SettingsStore['update']>[0]) => {
  const liveBefore = isStatusBarLiveStatsEnabled()
  const shortcutBefore = settingsStore.get().shortcuts.global.showApp
  if (partial.advanced?.shellContextMenu !== undefined) {
    await syncShellContextMenuRegistry(partial.advanced.shellContextMenu)
  }

  const updated = settingsStore.update(partial)
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
