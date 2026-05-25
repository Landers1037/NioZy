import { createRequire } from 'node:module'
import type {
  ElectronAPI,
  ReloadEnvironmentResult,
  AppMetricsData,
  SystemStatsData,
  UpdateCheckResult,
  UpdateDownloadPayload,
  UpdateDownloadResult,
  AppSettings,
} from '../shared/api-types'
import { parseInitialSettingsFromArgv } from '../shared/initial-settings'
import { createIpcMultiplex } from './ipc-multiplex'

const require = createRequire(import.meta.url)
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const initialSettings = parseInitialSettingsFromArgv(process.argv)

const onWindowMaximized = createIpcMultiplex<[boolean]>(ipcRenderer, 'window:maximized')
const onSystemStats = createIpcMultiplex<[SystemStatsData]>(ipcRenderer, 'system:stats')
const onAppOpenDirectory = createIpcMultiplex<[string]>(ipcRenderer, 'app:openDirectory')
const onTerminalData = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:data')
const onTerminalCwd = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:cwd')
const onTerminalExit = createIpcMultiplex<[string, number]>(ipcRenderer, 'terminal:exit')
const onSshTransferProgress = createIpcMultiplex<[import('../shared/ssh-types').ScpTransferProgress]>(
  ipcRenderer,
  'ssh:transferProgress',
)

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (cb) => onWindowMaximized(cb),
  },
  settings: {
    getInitial: (): AppSettings | null => initialSettings,
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial),
  },
  fonts: {
    list: () => ipcRenderer.invoke('fonts:list'),
  },
  system: {
    platform: process.platform,
    getStats: () => ipcRenderer.invoke('system:getStats'),
    onStats: (cb) => onSystemStats(cb),
    getAppMetrics: () =>
      ipcRenderer.invoke('system:getAppMetrics') as Promise<AppMetricsData>,
    reloadEnvironment: () =>
      ipcRenderer.invoke('system:reloadEnvironment') as Promise<ReloadEnvironmentResult>,
    isProcessElevated: () =>
      ipcRenderer.invoke('system:isProcessElevated') as Promise<boolean>,
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    getPendingOpenDirectory: () => ipcRenderer.invoke('app:getPendingOpenDirectory'),
    onOpenDirectory: (cb) => onAppOpenDirectory(cb),
    relaunch: () => ipcRenderer.send('app:relaunch'),
  },
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (id, data) => ipcRenderer.send('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
    kill: (id) => ipcRenderer.send('terminal:kill', id),
    setActiveStream: (id) => ipcRenderer.send('terminal:setActiveStream', id),
    setActiveStreams: (ids) => ipcRenderer.send('terminal:setActiveStreams', ids),
    onData: (cb) => onTerminalData(cb),
    onCwd: (cb) => onTerminalCwd(cb),
    onExit: (cb) => onTerminalExit(cb),
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    getKeys: () => ipcRenderer.invoke('vault:getKeys'),
    save: (input) => ipcRenderer.invoke('vault:save', input),
    remove: (id) => ipcRenderer.invoke('vault:remove', id),
    resolve: (text) => ipcRenderer.invoke('vault:resolve', text),
  },
  shell: {
    openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check') as Promise<UpdateCheckResult>,
    download: (payload: UpdateDownloadPayload) =>
      ipcRenderer.invoke('update:download', payload) as Promise<UpdateDownloadResult>,
  },
  files: {
    saveText: (content, defaultFileName) =>
      ipcRenderer.invoke('files:saveText', content, defaultFileName),
    listRoots: () => ipcRenderer.invoke('fs:listRoots'),
    getImagePreviewUrl: (filePath) => ipcRenderer.invoke('fs:getImagePreviewUrl', filePath),
    detectProgram: (options) => ipcRenderer.invoke('fs:detectProgram', options),
    openWithProgram: (programPath, targetPath) =>
      ipcRenderer.invoke('fs:openWithProgram', programPath, targetPath),
  },
  ssh: {
    checkScp: () => ipcRenderer.invoke('ssh:checkScp'),
    getProfile: (connectionId) => ipcRenderer.invoke('ssh:getProfile', connectionId),
    listLocal: (dirPath) => ipcRenderer.invoke('ssh:listLocal', dirPath),
    listRemote: (connectionId, remotePath, options) =>
      ipcRenderer.invoke('ssh:listRemote', connectionId, remotePath, options),
    upload: async (connectionId, localPath, remotePath, onProgress) => {
      const unsubscribe = onProgress
        ? onSshTransferProgress((progress) => onProgress(progress))
        : undefined
      try {
        return await ipcRenderer.invoke('ssh:upload', connectionId, localPath, remotePath)
      } finally {
        unsubscribe?.()
      }
    },
    download: async (connectionId, remotePath, localPath, onProgress) => {
      const unsubscribe = onProgress
        ? onSshTransferProgress((progress) => onProgress(progress))
        : undefined
      try {
        return await ipcRenderer.invoke('ssh:download', connectionId, remotePath, localPath)
      } finally {
        unsubscribe?.()
      }
    },
  },
}

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).electronAPI = api
  }
  console.log('[NioZy] preload: electronAPI exposed')
} catch (error) {
  console.error('[NioZy] preload: failed to expose electronAPI', error)
}
