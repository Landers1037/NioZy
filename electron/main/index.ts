import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'node:url'
import { TerminalService } from '../terminal-service'
import { SettingsStore } from '../settings-store'
import { SystemStats } from '../system-stats'
import { VaultStore } from '../vault-store'
import { syncGlobalShortcuts, unregisterGlobalShortcuts } from '../global-shortcuts'
import type { TerminalCreateOptions } from '../shared/api-types'

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
    mainWindow?.webContents.send('system:stats', stats)
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

  if (isDev) {
    console.log('[NioZy] preload script:', preloadPath, existsSync(preloadPath))
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: settings.theme === 'dark' ? '#0F1419' : '#F4F5F7',
    opacity: transparencyToOpacity(settings.advanced.transparency),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.on('preload-error', (_, path, error) => {
    console.error('[NioZy] Failed to load preload:', path, error)
  })

  mainWindow.on('ready-to-show', () => {
    syncWindowOpacity()
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (isDev && mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false)
  })

  mainWindow.on('close', (e) => {
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
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
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

app.whenReady().then(() => {
  settingsStore.load()
  vaultStore.load()

  if (isDev) {
    console.log('[NioZy] app path:', app.getAppPath())
    console.log('[NioZy] main dir:', __dirname)
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
  unregisterGlobalShortcuts()
  terminalService.disposeAll()
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
ipcMain.handle('settings:save', (_, partial: Parameters<SettingsStore['update']>[0]) => {
  const liveBefore = isStatusBarLiveStatsEnabled()
  const shortcutBefore = settingsStore.get().shortcuts.global.showApp
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
  return updated
})

ipcMain.handle('system:getStats', () => systemStats.getCurrent())

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

terminalService.on('data', (id, data) => {
  mainWindow?.webContents.send('terminal:data', id, data)
})
terminalService.on('exit', (id, code) => {
  mainWindow?.webContents.send('terminal:exit', id, code)
})
