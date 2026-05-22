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
import { augmentWindowsPath } from '../resolve-executable'
import { loadTrayIcon } from '../tray-icon'
import { applyChromiumPerformanceFlags, getOptimizedWebPreferences } from '../chromium-tuning'
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
import type { SshConnectionProfile, TerminalCreateOptions } from '../shared/api-types'
import * as sshService from '../ssh-service'
import { captureWindowState, getInitialWindowOptions } from '../window-bounds'
import { reloadSystemEnvironment } from '../reload-system-env'
import { checkForAppUpdate, downloadAndInstallUpdate } from '../app-update'
import { getWindowBackgroundColor } from '../shared/ui-style'

augmentWindowsPath()

setInitialOpenDirectoryFromArgv(process.argv)

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

if (!isHardwareAccelerationEnabled()) {
  app.disableHardwareAcceleration()
}

applyChromiumPerformanceFlags()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

/** 开发模式：electron-vite dev 或本地未打包运行 */
const isDev =
  !app.isPackaged ||
  !!process.env['ELECTRON_RENDERER_URL'] ||
  process.env['NODE_ENV_ELECTRON_VITE'] === 'development'

const terminalService = new TerminalService()
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
    webPreferences: getOptimizedWebPreferences(preloadPath, {
      disableSandbox: settings.advanced.disableSandbox,
    }),
  })

  mainWindow.webContents.on('preload-error', (_, path, error) => {
    console.error('[NioZy] Failed to load preload:', path, error)
  })

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
    { label: '显示 NioZy', click: () => mainWindow?.show() },
    {
      label: '退出',
      click: () => {
        settingsStore.update({
          system: { ...settingsStore.get().system, minimizeToTrayOnClose: false },
        })
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show())
}

if (gotSingleInstanceLock) {
  app.on('second-instance', (_event, argv) => {
    const directory = parseDirectoryFromArgv(argv)
    if (directory) handleOpenDirectoryRequest(directory)
    else showMainWindow()
  })
}

app.whenReady().then(async () => {
  settingsStore.load()
  vaultStore.load()

  if (isDev) {
    console.log('[NioZy] app path:', app.getAppPath())
    console.log('[NioZy] main dir:', __dirname)
  }

  if (settingsStore.get().advanced.shellContextMenu) {
    try {
      await syncShellContextMenuRegistry(true)
    } catch (err) {
      console.error('[NioZy] Failed to sync shell context menu registry:', err)
    }
  }

  createWindow()
  createTray()
  syncSystemStatsPolling()
  syncGlobalShortcuts(settingsStore, () => mainWindow)

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

ipcMain.handle('shell:openExternal', (_, url: string) => shell.openExternal(url))

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
  if (partial.theme !== undefined || partial.uiStyle !== undefined) {
    mainWindow?.setBackgroundColor(
      getWindowBackgroundColor(updated.theme, updated.uiStyle),
    )
  }
  return updated
})

ipcMain.handle('app:getPendingOpenDirectory', () => takePendingOpenDirectory())
ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('system:getStats', () => systemStats.getCurrent())
ipcMain.handle('system:getAppMetrics', () => getAppMetricsSnapshot())
ipcMain.handle('system:reloadEnvironment', () => reloadSystemEnvironment())

ipcMain.handle('update:check', () => checkForAppUpdate())
ipcMain.handle('update:download', (_, payload: { version: string; downloadUrl: string }) =>
  downloadAndInstallUpdate(payload.downloadUrl, payload.version),
)

ipcMain.handle('fonts:list', () => listSystemFonts())

function resolveSshProfile(connectionId: string): SshConnectionProfile | null {
  const conn = settingsStore.get().connections.find((c) => c.id === connectionId)
  if (!conn || conn.type !== 'ssh' || !conn.sshHost?.trim() || !conn.sshUser?.trim()) {
    return null
  }
  vaultStore.load()
  return {
    host: vaultStore.resolveText(conn.sshHost.trim()),
    user: vaultStore.resolveText(conn.sshUser.trim()),
    port: conn.sshPort ?? 22,
    keyPath:
      conn.sshAuth === 'publickey' && conn.sshKeyPath?.trim()
        ? vaultStore.resolveText(conn.sshKeyPath.trim())
        : undefined,
  }
}

ipcMain.handle('ssh:checkScp', () => sshService.checkScpInPath())
ipcMain.handle('ssh:getProfile', (_, connectionId: string) => resolveSshProfile(connectionId))
ipcMain.handle('ssh:listLocal', (_, dirPath: string) => sshService.listLocalDirectory(dirPath))
ipcMain.handle(
  'ssh:listRemote',
  (_, profile: SshConnectionProfile, remotePath: string) =>
    sshService.listRemoteDirectory(profile, remotePath),
)
ipcMain.handle(
  'ssh:upload',
  (_, profile: SshConnectionProfile, localPath: string, remotePath: string) =>
    sshService.scpUpload(profile, localPath, remotePath),
)
ipcMain.handle(
  'ssh:download',
  (_, profile: SshConnectionProfile, remotePath: string, localPath: string) =>
    sshService.scpDownload(profile, remotePath, localPath),
)

ipcMain.handle('terminal:create', (_, options: TerminalCreateOptions) => {
  const resolved = {
    ...options,
    command: options.command ? vaultStore.resolveText(options.command) : undefined,
    args: options.args?.map((arg: string) => vaultStore.resolveText(arg)),
    env: options.env ? vaultStore.resolveEnv(options.env) : undefined,
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
ipcMain.handle(
  'terminal:resize',
  (_, id: string, cols: number, rows: number) => terminalService.resize(id, cols, rows),
)
ipcMain.handle('terminal:kill', (_, id: string) => terminalService.kill(id))
ipcMain.handle('terminal:setActiveStream', (_, id: string | null) => {
  terminalService.setActiveStream(id)
})

terminalService.on('data', (id, data) => {
  sendToRenderer(mainWindow, 'terminal:data', id, data)
})
terminalService.on('exit', (id, code) => {
  sendToRenderer(mainWindow, 'terminal:exit', id, code)
})
terminalService.on('cwd', (id, cwd) => {
  sendToRenderer(mainWindow, 'terminal:cwd', id, cwd)
})
