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
  SettingsFileResult,
} from '../shared/api-types'
import { parseInitialSettingsFromArgv } from '../shared/initial-settings'
import { createIpcMultiplex } from './ipc-multiplex'

const require = createRequire(import.meta.url)
const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron')

const initialSettings = parseInitialSettingsFromArgv(process.argv)

const onWindowMaximized = createIpcMultiplex<[boolean]>(ipcRenderer, 'window:maximized')
const onSystemStats = createIpcMultiplex<[SystemStatsData]>(ipcRenderer, 'system:stats')
const onAppOpenDirectory = createIpcMultiplex<[string]>(ipcRenderer, 'app:openDirectory')
const onAppNewTerminal = createIpcMultiplex<[]>(ipcRenderer, 'app:newTerminal')
const onAppOpenSettings = createIpcMultiplex<[]>(ipcRenderer, 'app:openSettings')
const onTerminalData = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:data')
const onTerminalCwd = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:cwd')
const onTerminalExit = createIpcMultiplex<[string, number]>(ipcRenderer, 'terminal:exit')
const onSshTransferProgress = createIpcMultiplex<[import('../shared/ssh-types').ScpTransferProgress]>(
  ipcRenderer,
  'ssh:transferProgress',
)
const onP2pSessionRequest = createIpcMultiplex<[import('../shared/p2p-types').P2pIncomingRequest]>(
  ipcRenderer,
  'p2p:sessionRequest',
)
const onP2pSessionEstablished = createIpcMultiplex<[import('../shared/p2p-types').P2pSessionInfo]>(
  ipcRenderer,
  'p2p:sessionEstablished',
)
const onP2pSessionDisconnected = createIpcMultiplex<[import('../shared/p2p-types').P2pSessionInfo]>(
  ipcRenderer,
  'p2p:sessionDisconnected',
)
const onP2pSessionClosed = createIpcMultiplex<[{ sessionId: string }]>(
  ipcRenderer,
  'p2p:sessionClosed',
)
const onP2pMessage = createIpcMultiplex<[import('../shared/p2p-types').P2pChatMessage]>(
  ipcRenderer,
  'p2p:message',
)
const onP2pFileProgress = createIpcMultiplex<[import('../shared/p2p-types').P2pFileProgress]>(
  ipcRenderer,
  'p2p:fileProgress',
)

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (cb) => onWindowMaximized(cb),
    snap: (layout) => ipcRenderer.send('window:snap', layout),
    toggleSnapRestore: () => ipcRenderer.invoke('window:toggleSnapRestore') as Promise<boolean>,
  },
  settings: {
    getInitial: (): AppSettings | null => initialSettings,
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial),
    exportToFile: () =>
      ipcRenderer.invoke('settings:exportToFile') as Promise<SettingsFileResult>,
    importFromFile: () =>
      ipcRenderer.invoke('settings:importFromFile') as Promise<SettingsFileResult>,
  },
  copilot: {
    getRuntimeUrl: () => ipcRenderer.invoke('copilot:getRuntimeUrl') as Promise<string | null>,
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
    onNewTerminal: (cb) => onAppNewTerminal(() => cb()),
    onOpenSettings: (cb) => onAppOpenSettings(() => cb()),
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
    pickBackground: () => ipcRenderer.invoke('terminal:pickBackground'),
    clearBackground: () => ipcRenderer.invoke('terminal:clearBackground'),
    getBackgroundUrl: (ext) => ipcRenderer.invoke('terminal:getBackgroundUrl', ext),
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
  preview: {
    openLink: (tabId, url, bounds) => ipcRenderer.send('preview:openLink', tabId, url, bounds),
    setBounds: (tabId, bounds) => ipcRenderer.send('preview:setBounds', tabId, bounds),
    setVisible: (tabId, visible) => ipcRenderer.send('preview:setVisible', tabId, visible),
    close: (tabId) => ipcRenderer.send('preview:close', tabId),
    setOverlaySuppressed: (suppressed) =>
      ipcRenderer.send('preview:setOverlaySuppressed', suppressed),
    clearWebviewBrowsingData: () =>
      ipcRenderer.invoke('preview:clearWebviewBrowsingData') as Promise<{
        ok: boolean
        error?: string
      }>,
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
    getTerminalFilePreviewUrl: (filePath, kind) =>
      ipcRenderer.invoke('fs:getTerminalFilePreviewUrl', filePath, kind),
    detectProgram: (options) => ipcRenderer.invoke('fs:detectProgram', options),
    openWithProgram: (programPath, targetPath) =>
      ipcRenderer.invoke('fs:openWithProgram', programPath, targetPath),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    resolveTerminalDropDirectory: (filePath) =>
      ipcRenderer.invoke('fs:resolveTerminalDropDirectory', filePath),
    pickPrivateKey: () => ipcRenderer.invoke('files:pickPrivateKey') as Promise<string | null>,
  },
  logging: {
    openLogDirectory: () => ipcRenderer.invoke('logging:openLogDirectory') as Promise<void>,
  },
  statistics: {
    get: () => ipcRenderer.invoke('statistics:get'),
    recordTabOpen: () => ipcRenderer.send('statistics:recordTabOpen'),
    recordTabClose: () => ipcRenderer.send('statistics:recordTabClose'),
    clear: () => ipcRenderer.invoke('statistics:clear') as Promise<void>,
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
  screenshot: {
    open: () => ipcRenderer.send('screenshot:open'),
    close: () => ipcRenderer.send('screenshot:close'),
    enterEditMode: () => ipcRenderer.send('screenshot:enterEditMode'),
    captureScreen: async () => {
      const res = (await ipcRenderer.invoke('screenshot:captureScreen')) as
        | { ok: true; dataUrl: string; width: number; height: number }
        | { ok: false; error: string }
      if (!res.ok) throw new Error(res.error || 'CAPTURE_FAILED')
      return { dataUrl: res.dataUrl, width: res.width, height: res.height }
    },
    savePng: (dataUrl, defaultFileName) =>
      ipcRenderer.invoke('screenshot:savePng', { dataUrl, defaultFileName }) as Promise<{
        ok: boolean
        canceled?: boolean
        error?: string
      }>,
    copyToClipboard: (dataUrl) =>
      ipcRenderer.invoke('screenshot:copyToClipboard', { dataUrl }) as Promise<{
        ok: boolean
        error?: string
      }>,
  },
  p2p: {
    getStatus: () => ipcRenderer.invoke('p2p:getStatus'),
    scan: () => ipcRenderer.invoke('p2p:scan'),
    connect: (host, port, message) => ipcRenderer.invoke('p2p:connect', host, port, message),
    acceptRequest: (requestId) => ipcRenderer.invoke('p2p:acceptRequest', requestId),
    rejectRequest: (requestId) => ipcRenderer.invoke('p2p:rejectRequest', requestId),
    disconnect: (sessionId) => ipcRenderer.invoke('p2p:disconnect', sessionId),
    sendText: (sessionId, text) => ipcRenderer.invoke('p2p:sendText', sessionId, text),
    sendFile: (sessionId, localPath) => ipcRenderer.invoke('p2p:sendFile', sessionId, localPath),
    pickAndSendFile: (sessionId, imagesOnly) =>
      ipcRenderer.invoke('p2p:pickAndSendFile', sessionId, imagesOnly),
    getSessions: () => ipcRenderer.invoke('p2p:getSessions'),
    getHistory: (sessionId) => ipcRenderer.invoke('p2p:getHistory', sessionId),
    getFullHistory: (sessionId) => ipcRenderer.invoke('p2p:getFullHistory', sessionId),
    clearHistory: (sessionId) => ipcRenderer.invoke('p2p:clearHistory', sessionId),
    openChatDirectory: () => ipcRenderer.invoke('p2p:openChatDirectory') as Promise<void>,
    onSessionRequest: (cb) => onP2pSessionRequest(cb),
    onSessionEstablished: (cb) => onP2pSessionEstablished(cb),
    onSessionDisconnected: (cb) => onP2pSessionDisconnected(cb),
    onSessionClosed: (cb) => onP2pSessionClosed(cb),
    onMessage: (cb) => onP2pMessage(cb),
    onFileProgress: (cb) => onP2pFileProgress(cb),
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
