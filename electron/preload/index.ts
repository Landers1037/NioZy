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
import { devError, devLog } from '../shared/dev-log'
import { createIpcMultiplex } from './ipc-multiplex'

const require = createRequire(import.meta.url)
const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron')

const initialSettings = parseInitialSettingsFromArgv(process.argv)

const onWindowMaximized = createIpcMultiplex<[boolean]>(ipcRenderer, 'window:maximized')
const onWindowMoving = createIpcMultiplex<[boolean]>(ipcRenderer, 'window:moving')
/** 窗口拖拽期间丢弃 terminal:data，避免 xterm / Shell 高亮占用主线程 */
let terminalIpcPaused = false

function syncTerminalIpcPaused(moving: boolean): void {
  terminalIpcPaused = moving
}

onWindowMoving((moving) => {
  syncTerminalIpcPaused(moving)
})
const onSystemStats = createIpcMultiplex<[SystemStatsData]>(ipcRenderer, 'system:stats')
const onAppOpenDirectory = createIpcMultiplex<[string]>(ipcRenderer, 'app:openDirectory')
const onAppNewTerminal = createIpcMultiplex<[]>(ipcRenderer, 'app:newTerminal')
const onAppOpenSettings = createIpcMultiplex<[]>(ipcRenderer, 'app:openSettings')
const onTerminalData = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:data')
const onTerminalCwd = createIpcMultiplex<[string, string]>(ipcRenderer, 'terminal:cwd')
const onTerminalExit = createIpcMultiplex<[string, number]>(ipcRenderer, 'terminal:exit')
const onMuxData = createIpcMultiplex<[string, string]>(ipcRenderer, 'mux:data')
const onMuxCwd = createIpcMultiplex<[string, number, string]>(ipcRenderer, 'mux:cwd')
const onMuxExit = createIpcMultiplex<[string, number]>(ipcRenderer, 'mux:exit')
const onSshTransferProgress = createIpcMultiplex<[import('../shared/ssh-types').ScpTransferProgress]>(
  ipcRenderer,
  'ssh:transferProgress',
)
const onFtpTransferProgress = createIpcMultiplex<[import('../shared/ssh-types').ScpTransferProgress]>(
  ipcRenderer,
  'ftp:transferProgress',
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
const onRepoCloneOutput = createIpcMultiplex<[string]>(ipcRenderer, 'repo:cloneOutput')
const onP2pConversationHidden = createIpcMultiplex<[{ sessionId: string }]>(
  ipcRenderer,
  'p2p:conversationHidden',
)
const onP2pMessage = createIpcMultiplex<[import('../shared/p2p-types').P2pChatMessage]>(
  ipcRenderer,
  'p2p:message',
)
const onP2pFileProgress = createIpcMultiplex<[import('../shared/p2p-types').P2pFileProgress]>(
  ipcRenderer,
  'p2p:fileProgress',
)
const onReminderDue = createIpcMultiplex<[import('../shared/reminder-data').ReminderDuePayload]>(
  ipcRenderer,
  'reminder:due',
)
const onAgentEvent = createIpcMultiplex<[import('../shared/agent-types').AgentEvent]>(
  ipcRenderer,
  'agent:event',
)
const onSettingsChanged = createIpcMultiplex<[AppSettings]>(ipcRenderer, 'settings:changed')

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (cb) => onWindowMaximized(cb),
    onMoving: (cb) => onWindowMoving(cb),
    setDragging: (moving: boolean) => {
      syncTerminalIpcPaused(moving)
      ipcRenderer.send('window:setDragging', moving)
    },
    snap: (layout) => ipcRenderer.send('window:snap', layout),
    toggleSnapRestore: () => ipcRenderer.invoke('window:toggleSnapRestore') as Promise<boolean>,
    setTransparencyPreview: (transparency) =>
      ipcRenderer.send('window:setTransparencyPreview', transparency),
  },
  settings: {
    getInitial: (): AppSettings | null => initialSettings,
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial),
    onChanged: (cb) => onSettingsChanged(cb),
    exportToFile: () =>
      ipcRenderer.invoke('settings:exportToFile') as Promise<SettingsFileResult>,
    importFromFile: () =>
      ipcRenderer.invoke('settings:importFromFile') as Promise<SettingsFileResult>,
  },
  providers: {
    getState: () => ipcRenderer.invoke('providers:getState'),
    save: (input) => ipcRenderer.invoke('providers:save', input),
    delete: (id) => ipcRenderer.invoke('providers:delete', id),
    activate: (id) => ipcRenderer.invoke('providers:activate', id),
  },
  agent: {
    ensureRuntime: () => ipcRenderer.invoke('agent:ensureRuntime'),
    getState: () => ipcRenderer.invoke('agent:getState'),
    pickDirectory: () => ipcRenderer.invoke('agent:pickDirectory') as Promise<string | null>,
    setWorkspaceDir: (dir) => ipcRenderer.invoke('agent:setWorkspaceDir', dir),
    setModel: (model) => ipcRenderer.invoke('agent:setModel', model),
    setMode: (mode) => ipcRenderer.invoke('agent:setMode', mode),
    sendMessage: (input) => ipcRenderer.invoke('agent:sendMessage', input),
    resetSession: () => ipcRenderer.invoke('agent:resetSession'),
    onEvent: (cb) => onAgentEvent(cb),
  },
  copilot: {
    getRuntimeUrl: () => ipcRenderer.invoke('copilot:getRuntimeUrl') as Promise<string | null>,
  },
  aiContext: {
    listRules: () =>
      ipcRenderer.invoke('aiContext:listRules') as Promise<
        import('../shared/ai-context-types').AiRuleSummary[]
      >,
    readRule: (id) => ipcRenderer.invoke('aiContext:readRule', id) as Promise<string | null>,
    saveRule: (input) => ipcRenderer.invoke('aiContext:saveRule', input) as Promise<void>,
    deleteRule: (id) => ipcRenderer.invoke('aiContext:deleteRule', id) as Promise<void>,
    listSkills: () =>
      ipcRenderer.invoke('aiContext:listSkills') as Promise<
        import('../shared/ai-context-types').AiSkillSummary[]
      >,
    getChatContext: () =>
      ipcRenderer.invoke('aiContext:getChatContext') as Promise<
        import('../shared/ai-context-types').AiChatContextPayload
      >,
    openSkillsDirectory: () =>
      ipcRenderer.invoke('aiContext:openSkillsDirectory') as Promise<void>,
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
    getRuntimeVersions: () =>
      ipcRenderer.invoke('app:getRuntimeVersions') as Promise<import('../shared/api-types').AppRuntimeVersions>,
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
    isAlive: (id) => ipcRenderer.invoke('terminal:isAlive', id) as Promise<boolean>,
    setActiveStream: (id) => ipcRenderer.send('terminal:setActiveStream', id),
    setActiveStreams: (ids, options) =>
      ipcRenderer.send('terminal:setActiveStreams', ids, options),
    claimStream: (id) => ipcRenderer.invoke('terminal:claimStream', id) as Promise<string>,
    ackData: (id, length) => ipcRenderer.send('terminal:ackData', id, length),
    onData: (cb) =>
      onTerminalData((id, data) => {
        if (terminalIpcPaused) return
        cb(id, data)
      }),
    onCwd: (cb) => onTerminalCwd(cb),
    onExit: (cb) => onTerminalExit(cb),
    pickBackground: () => ipcRenderer.invoke('terminal:pickBackground'),
    clearBackground: () => ipcRenderer.invoke('terminal:clearBackground'),
    getBackgroundUrl: (ext) => ipcRenderer.invoke('terminal:getBackgroundUrl', ext),
  },
  muxTerminal: {
    create: (options) => ipcRenderer.invoke('muxTerminal:create', options),
    write: (id, data, paneIndex) => ipcRenderer.send('muxTerminal:write', id, data, paneIndex),
    resize: (id, cols, rows) => ipcRenderer.send('muxTerminal:resize', id, cols, rows),
    setFocus: (id, paneIndex) => ipcRenderer.send('muxTerminal:setFocus', id, paneIndex),
    scroll: (id, delta, paneIndex) => ipcRenderer.send('muxTerminal:scroll', id, delta, paneIndex),
    setResizeMode: (id, enabled) =>
      ipcRenderer.invoke('muxTerminal:setResizeMode', id, enabled) as Promise<boolean>,
    adjustSplit: (id, direction) =>
      ipcRenderer.invoke('muxTerminal:adjustSplit', id, direction) as Promise<boolean>,
    closePane: (id, paneIndex) =>
      ipcRenderer.invoke('muxTerminal:closePane', id, paneIndex) as Promise<
        import('../shared/mux-terminal-types').MuxClosePaneResult | null
      >,
    kill: (id) => ipcRenderer.send('muxTerminal:kill', id),
    isAlive: (id) => ipcRenderer.invoke('muxTerminal:isAlive', id) as Promise<boolean>,
    setActiveStreams: (ids) => ipcRenderer.send('muxTerminal:setActiveStreams', ids),
    claimStream: (id) => ipcRenderer.invoke('muxTerminal:claimStream', id) as Promise<string>,
    debugLog: (level, message, detail) =>
      ipcRenderer.send('muxTerminal:debugLog', level, message, detail),
    onData: (cb) =>
      onMuxData((id, data) => {
        if (terminalIpcPaused) return
        cb(id, data)
      }),
    onCwd: (cb) => onMuxCwd(cb),
    onExit: (cb) => onMuxExit(cb),
  },
  resumeTerm: {
    load: () => ipcRenderer.invoke('resumeTerm:load'),
    save: (session) => ipcRenderer.invoke('resumeTerm:save', session),
    clear: () => ipcRenderer.invoke('resumeTerm:clear'),
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    getKeys: () => ipcRenderer.invoke('vault:getKeys'),
    save: (input) => ipcRenderer.invoke('vault:save', input),
    remove: (id) => ipcRenderer.invoke('vault:remove', id),
    resolve: (text) => ipcRenderer.invoke('vault:resolve', text),
    resolveBatch: (texts) => ipcRenderer.invoke('vault:resolveBatch', texts),
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
    saveImage: (input) => ipcRenderer.invoke('files:saveImage', input),
    listRoots: () => ipcRenderer.invoke('fs:listRoots'),
    listFavorites: () => ipcRenderer.invoke('fs:listFavorites'),
    addFavorite: (path: string) => ipcRenderer.invoke('fs:addFavorite', path),
    removeFavorite: (id: string) => ipcRenderer.invoke('fs:removeFavorite', id),
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
    pickAgentLogFile: () =>
      ipcRenderer.invoke('files:pickAgentLogFile') as Promise<string | null>,
    pickAiAttachments: (dialogTitle?: string) =>
      ipcRenderer.invoke('files:pickAiAttachments', dialogTitle) as Promise<
        import('../shared/ai-attachment-types').AiAttachmentPickFile[]
      >,
  },
  drawing: {
    openFile: (kind) => ipcRenderer.invoke('drawing:openFile', kind),
    saveFile: (input) => ipcRenderer.invoke('drawing:saveFile', input),
  },
  markdown: {
    readFile: (filePath) => ipcRenderer.invoke('markdown:readFile', filePath),
    openFile: () => ipcRenderer.invoke('markdown:openFile'),
    saveFile: (input) => ipcRenderer.invoke('markdown:saveFile', input),
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
  reminder: {
    list: () => ipcRenderer.invoke('reminder:list'),
    save: (item) => ipcRenderer.invoke('reminder:save', item),
    delete: (id) => ipcRenderer.invoke('reminder:delete', id),
    snooze: (ids, minutes) => ipcRenderer.invoke('reminder:snooze', ids, minutes),
    dismiss: (ids) => ipcRenderer.invoke('reminder:dismiss', ids),
    clearCompleted: () => ipcRenderer.invoke('reminder:clearCompleted') as Promise<number>,
    pickImage: () => ipcRenderer.invoke('reminder:pickImage'),
    clearImage: () => ipcRenderer.invoke('reminder:clearImage'),
    getImageUrl: () => ipcRenderer.invoke('reminder:getImageUrl'),
    listPets: () => ipcRenderer.invoke('reminder:listPets'),
    importPet: (name) => ipcRenderer.invoke('reminder:importPet', name),
    deletePet: (petId) => ipcRenderer.invoke('reminder:deletePet', petId),
    listPetAnimationStates: (petId) => ipcRenderer.invoke('reminder:listPetAnimationStates', petId),
    getPetPreviewUrl: (petId) => ipcRenderer.invoke('reminder:getPetPreviewUrl', petId),
    isBuiltinPet: (petId) => ipcRenderer.invoke('reminder:isBuiltinPet', petId),
    onDue: (cb) => onReminderDue(cb),
  },
  rdp: {
    connect: (connectionId) => ipcRenderer.invoke('rdp:connect', connectionId),
  },
  putty: {
    connect: (connectionId) => ipcRenderer.invoke('putty:connect', connectionId),
  },
  vnc: {
    startProxy: (input) => ipcRenderer.invoke('vnc:startProxy', input) as Promise<{ wsUrl: string }>,
    stopProxy: (input) => ipcRenderer.invoke('vnc:stopProxy', input) as Promise<void>,
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
  ftp: {
    getProfile: (connectionId) => ipcRenderer.invoke('ftp:getProfile', connectionId),
    listRemote: (connectionId, remotePath, options) =>
      ipcRenderer.invoke('ftp:listRemote', connectionId, remotePath, options),
    upload: async (connectionId, localPath, remotePath, onProgress) => {
      const unsubscribe = onProgress
        ? onFtpTransferProgress((progress) => onProgress(progress))
        : undefined
      try {
        return await ipcRenderer.invoke('ftp:upload', connectionId, localPath, remotePath)
      } finally {
        unsubscribe?.()
      }
    },
    download: async (connectionId, remotePath, localPath, onProgress) => {
      const unsubscribe = onProgress
        ? onFtpTransferProgress((progress) => onProgress(progress))
        : undefined
      try {
        return await ipcRenderer.invoke('ftp:download', connectionId, remotePath, localPath)
      } finally {
        unsubscribe?.()
      }
    },
    downloadDirectory: async (connectionId, remotePath, localPath, onProgress) => {
      const unsubscribe = onProgress
        ? onFtpTransferProgress((progress) => onProgress(progress))
        : undefined
      try {
        return await ipcRenderer.invoke(
          'ftp:downloadDirectory',
          connectionId,
          remotePath,
          localPath,
        )
      } finally {
        unsubscribe?.()
      }
    },
  },
  screenshot: {
    open: () => ipcRenderer.send('screenshot:open'),
    close: () => ipcRenderer.send('screenshot:close'),
  },
  connectivity: {
    check: (input) => ipcRenderer.invoke('connectivity:check', input),
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
    getConversations: () => ipcRenderer.invoke('p2p:getConversations'),
    openConversation: (deviceId) => ipcRenderer.invoke('p2p:openConversation', deviceId),
    hideFromSidebar: (sessionId) => ipcRenderer.invoke('p2p:hideFromSidebar', sessionId),
    removeConversation: (sessionId) => ipcRenderer.invoke('p2p:removeConversation', sessionId),
    getHistory: (sessionId) => ipcRenderer.invoke('p2p:getHistory', sessionId),
    getFullHistory: (sessionId) => ipcRenderer.invoke('p2p:getFullHistory', sessionId),
    clearHistory: (sessionId) => ipcRenderer.invoke('p2p:clearHistory', sessionId),
    openChatDirectory: () => ipcRenderer.invoke('p2p:openChatDirectory') as Promise<void>,
    onSessionRequest: (cb) => onP2pSessionRequest(cb),
    onSessionEstablished: (cb) => onP2pSessionEstablished(cb),
    onSessionDisconnected: (cb) => onP2pSessionDisconnected(cb),
    onSessionClosed: (cb) => onP2pSessionClosed(cb),
    onConversationHidden: (cb) => onP2pConversationHidden(cb),
    onMessage: (cb) => onP2pMessage(cb),
    onFileProgress: (cb) => onP2pFileProgress(cb),
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    save: (input) => ipcRenderer.invoke('notes:save', input),
    delete: (id) => ipcRenderer.invoke('notes:delete', id),
  },
  repo: {
    detectGit: () => ipcRenderer.invoke('repo:detectGit'),
    pickDirectory: () => ipcRenderer.invoke('repo:pickDirectory') as Promise<string | null>,
    pickParentDirectory: () =>
      ipcRenderer.invoke('repo:pickParentDirectory') as Promise<string | null>,
    validateRepo: (path) => ipcRenderer.invoke('repo:validateRepo', path),
    listManaged: () => ipcRenderer.invoke('repo:listManaged'),
    add: (path) => ipcRenderer.invoke('repo:add', path),
    remove: (id) => ipcRenderer.invoke('repo:remove', id),
    pull: (id) => ipcRenderer.invoke('repo:pull', id),
    clone: (params) => ipcRenderer.invoke('repo:clone', params),
    onCloneOutput: (cb) => onRepoCloneOutput(cb),
    listBranches: (id) => ipcRenderer.invoke('repo:listBranches', id),
    checkout: (id, branch) => ipcRenderer.invoke('repo:checkout', id, branch),
    getGraphCommits: (id, cursor) => ipcRenderer.invoke('repo:getGraphCommits', id, cursor),
    getCommitDetail: (id, sha) => ipcRenderer.invoke('repo:getCommitDetail', id, sha),
    getCommitFileDiff: (id, sha, filePath) =>
      ipcRenderer.invoke('repo:getCommitFileDiff', id, sha, filePath),
    getById: (id) => ipcRenderer.invoke('repo:getById', id),
  },
  session: {
    listClaudeCodeSessions: (historyPath) =>
      ipcRenderer.invoke('session:listClaudeCodeSessions', historyPath),
    listOpenCodeSessions: (dbPath) =>
      ipcRenderer.invoke('session:listOpenCodeSessions', dbPath),
  },
  workspace: {
    getHomeDir: () => ipcRenderer.invoke('workspace:getHomeDir'),
    listDir: (dirPath) => ipcRenderer.invoke('workspace:listDir', dirPath),
    pickDirectory: () => ipcRenderer.invoke('workspace:pickDirectory'),
    detectGit: (workDir) => ipcRenderer.invoke('workspace:detectGit', workDir),
    gitBranch: (workDir) => ipcRenderer.invoke('workspace:gitBranch', workDir),
    gitStatus: (workDir) => ipcRenderer.invoke('workspace:gitStatus', workDir),
    gitDiff: (workDir, filePath) => ipcRenderer.invoke('workspace:gitDiff', workDir, filePath),
    listHistory: () => ipcRenderer.invoke('workspace:listHistory'),
    recordHistory: (input) => ipcRenderer.invoke('workspace:recordHistory', input),
  },
}

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).electronAPI = api
  }
  devLog('[NioZy] preload: electronAPI exposed')
} catch (error) {
  devError('[NioZy] preload: failed to expose electronAPI', error)
}
