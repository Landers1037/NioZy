import type {
  AppMetricsData,
  AppSettings,
  ElectronAPI,
  SystemStatsData,
  VaultVariablePublic,
} from '../../electron/shared/api-types'
import { DEFAULT_SHORTCUTS } from '../../electron/shared/shortcuts'
import { DEFAULT_BUILTIN_CONNECTIONS } from '../../electron/shared/builtin-shells'
import { DEFAULT_SSH_SETTINGS } from '../../electron/shared/ssh-settings'
import { DEFAULT_SHELL_SETTINGS } from '../../electron/shared/shell-settings'
import { DEFAULT_PERFORMANCE_SETTINGS } from '../../electron/shared/performance-settings'
import { DEFAULT_FILESYSTEM_SETTINGS } from '../../electron/shared/filesystem-settings'
import { DEFAULT_EXPERIMENTAL_SETTINGS } from '../../electron/shared/experimental-settings'
import { DEFAULT_TERMINAL_SCROLLBACK } from '../../electron/shared/terminal-xterm'

const DEFAULT_SETTINGS: AppSettings = {
  locale: 'zh',
  theme: 'light',
  uiStyle: 'minimal',
  layoutMode: 'default',
  sidebarWidth: 260,
  accentColor: '#5C6B7A',
  fontSize: 13,
  showAppTitle: true,
  enableDialogAnimations: true,
  terminal: {
    colorScheme: 'atom',
    fontFamily: 'Consolas',
    fontSize: 13,
    renderer: 'webgl',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: DEFAULT_TERMINAL_SCROLLBACK,
    drawBoldTextInBrightColors: true,
    rightClickCopyPaste: true,
  },
  connections: [],
  builtinConnections: { ...DEFAULT_BUILTIN_CONNECTIONS },
  defaultTerminal: 'powershell',
  system: {
    proxy: '',
    launchOnStartup: false,
    minimizeToTrayOnClose: true,
  },
  advanced: {
    hardwareAcceleration: true,
    disableSandbox: true,
    transparency: 100,
    statusBarLiveStats: true,
    shellContextMenu: false,
    preserveWindowBounds: false,
    debugLog: false,
  },
  shortcuts: { ...DEFAULT_SHORTCUTS },
  ssh: { ...DEFAULT_SSH_SETTINGS },
  shell: { ...DEFAULT_SHELL_SETTINGS },
  performance: { ...DEFAULT_PERFORMANCE_SETTINGS },
  filesystem: { ...DEFAULT_FILESYSTEM_SETTINGS },
  experimental: { ...DEFAULT_EXPERIMENTAL_SETTINGS },
}

let mockVault: VaultVariablePublic[] = []

type DataListener = (id: string, data: string) => void
type CwdListener = (id: string, cwd: string) => void
type StatsListener = (stats: SystemStatsData) => void

let mockSettings: AppSettings = structuredClone(DEFAULT_SETTINGS)
let mockTermCounter = 0
const dataListeners = new Set<DataListener>()
const cwdListeners = new Set<CwdListener>()
const statsListeners = new Set<StatsListener>()

function mockSystemStats(): SystemStatsData {
  return {
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 8),
    cpuPercent: 12,
    memoryPercent: 48,
    memoryUsedMb: 8192,
    memoryTotalMb: 16384,
  }
}

function mockAppMetrics(): AppMetricsData {
  return {
    totalWorkingSetMb: 256,
    totalPeakWorkingSetMb: 312,
    mainHeapUsedMb: 42,
    mainHeapTotalMb: 64,
    mainRssMb: 88,
    processes: [
      {
        pid: 10001,
        type: 'Browser',
        workingSetMb: 120,
        peakWorkingSetMb: 140,
        cpuPercent: 2.5,
        sandboxed: false,
      },
      {
        pid: 10002,
        type: 'Tab',
        workingSetMb: 96,
        peakWorkingSetMb: 110,
        cpuPercent: 1.2,
        sandboxed: true,
      },
      {
        pid: 10003,
        type: 'GPU',
        workingSetMb: 40,
        peakWorkingSetMb: 62,
        cpuPercent: 0.4,
        sandboxed: true,
      },
    ],
    fetchedAt: new Date().toISOString(),
  }
}

function emitData(id: string, data: string): void {
  for (const cb of dataListeners) cb(id, data)
}

function mergeSettings(partial: Partial<AppSettings>): AppSettings {
  return {
    ...mockSettings,
    ...partial,
    terminal: { ...mockSettings.terminal, ...partial.terminal },
    system: { ...mockSettings.system, ...partial.system },
    advanced: { ...mockSettings.advanced, ...partial.advanced },
    shortcuts: partial.shortcuts
      ? {
          ...mockSettings.shortcuts,
          ...partial.shortcuts,
          global: { ...mockSettings.shortcuts.global, ...partial.shortcuts.global },
          app: { ...mockSettings.shortcuts.app, ...partial.shortcuts.app },
        }
      : mockSettings.shortcuts,
    ssh: partial.ssh ? { ...mockSettings.ssh, ...partial.ssh } : mockSettings.ssh,
    shell: partial.shell ? { ...mockSettings.shell, ...partial.shell } : mockSettings.shell,
    experimental: partial.experimental
      ? { ...mockSettings.experimental, ...partial.experimental }
      : mockSettings.experimental,
    connections: partial.connections ?? mockSettings.connections,
    builtinConnections: partial.builtinConnections ?? mockSettings.builtinConnections,
  }
}

const VAULT_REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

function resolveVaultText(text: string): string {
  return text.replace(VAULT_REF, (_, key: string) => {
    const v = mockVault.find((x) => x.key === key)
    if (!v) return `\${${key}}`
    return v.type === 'plain' ? (v.value ?? '') : '[secret]'
  })
}

function welcomeMessage(shell: string): string {
  return (
    '\r\n\x1b[36m[NioZy 浏览器开发预览]\x1b[0m\r\n' +
    `\x1b[90m模拟终端 (${shell})，仅用于 UI 调试。真实终端请用 npm run start。\x1b[0m\r\n\r\n` +
    '$ '
  )
}

export type BrowserDevElectronAPI = ElectronAPI & { __browserDevMock: true }

export function createBrowserDevElectronAPI(): BrowserDevElectronAPI {
  return {
    __browserDevMock: true,
    window: {
      minimize: () => undefined,
      maximize: () => undefined,
      close: () => undefined,
      isMaximized: async () => false,
      onMaximized: () => () => undefined,
    },
    settings: {
      getInitial: () => structuredClone(mockSettings),
      get: async () => structuredClone(mockSettings),
      save: async (partial) => {
        mockSettings = mergeSettings(partial)
        return structuredClone(mockSettings)
      },
    },
    system: {
      platform: 'win32',
      isProcessElevated: async () => false,
      reloadEnvironment: async () => ({
        ok: true,
        variableCount: 0,
        pathSegmentCount: 0,
      }),
      getStats: async () => mockSystemStats(),
      getAppMetrics: async () => mockAppMetrics(),
      onStats: (cb) => {
        statsListeners.add(cb)
        cb(mockSystemStats())
        const id = setInterval(() => {
          const stats = mockSystemStats()
          for (const listener of statsListeners) listener(stats)
        }, 2000)
        return () => {
          clearInterval(id)
          statsListeners.delete(cb)
        }
      },
    },
    vault: {
      list: async () => structuredClone(mockVault),
      getKeys: async () => mockVault.map((v) => v.key),
      save: async (input) => {
        const entry: VaultVariablePublic =
          input.type === 'plain'
            ? {
                id: input.id ?? `mock-${mockVault.length}`,
                key: input.key,
                type: 'plain',
                value: input.value ?? '',
              }
            : {
                id: input.id ?? `mock-${mockVault.length}`,
                key: input.key,
                type: 'secret',
              }
        const idx = input.id ? mockVault.findIndex((v) => v.id === input.id) : -1
        if (idx >= 0) mockVault[idx] = entry
        else mockVault.push(entry)
        return structuredClone(entry)
      },
      remove: async (id) => {
        mockVault = mockVault.filter((v) => v.id !== id)
      },
      resolve: async (text) => resolveVaultText(text),
    },
    app: {
      getVersion: async () => '0.1.0',
      getPendingOpenDirectory: async () => null,
      onOpenDirectory: () => () => undefined,
      onNewTerminal: () => () => undefined,
      onOpenSettings: () => () => undefined,
      relaunch: () => {
        window.location.reload()
      },
    },
    update: {
      check: async () => ({
        ok: true,
        hasUpdate: false,
        currentVersion: '0.1.0',
      }),
      download: async () => ({
        ok: false,
        error: 'Browser preview cannot download updates',
      }),
    },
    fonts: {
      list: async () => [
        'Arial',
        'Consolas',
        'Courier New',
        'Cascadia Code',
        'Cascadia Mono',
        'Microsoft YaHei',
        'Segoe UI',
        'SimSun',
        'Times New Roman',
      ],
    },
    shell: {
      openExternal: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    },
    ssh: {
      checkScp: async () => ({ found: false }),
      getProfile: async () => null,
      listLocal: async () => ({
        ok: true,
        entries: [
          {
            name: 'Documents',
            path: 'C:\\Users\\Developer\\Documents',
            isDirectory: true,
          },
          { name: 'readme.txt', path: 'C:\\Users\\Developer\\readme.txt', isDirectory: false, size: 128 },
        ],
      }),
      listRemote: async () => ({
        ok: true,
        entries: [
          { name: 'home', path: '/home/dev', isDirectory: true },
          { name: 'app.log', path: '/home/dev/app.log', isDirectory: false, size: 4096 },
        ],
      }),
      upload: async (_id, _local, _remote, onProgress) => {
        onProgress?.({
          direction: 'upload',
          fileName: 'sample.bin',
          transferred: 512,
          total: 1024,
        })
        return { ok: false, error: 'Browser preview' }
      },
      download: async (_id, _remote, _local, onProgress) => {
        onProgress?.({
          direction: 'download',
          fileName: 'sample.bin',
          transferred: 256,
          total: 1024,
        })
        return { ok: false, error: 'Browser preview' }
      },
    },
    files: {
      saveText: async (content, defaultFileName) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultFileName
        a.click()
        URL.revokeObjectURL(url)
        return true
      },
      listRoots: async () => ({
        ok: true,
        entries: [
          { name: 'C:', path: 'C:\\', isDirectory: true },
          { name: 'D:', path: 'D:\\', isDirectory: true },
        ],
      }),
      getImagePreviewUrl: async (filePath) => {
        if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(filePath)) {
          return { ok: false, error: 'Browser preview: not an image' }
        }
        return {
          ok: true,
          url: `niozy-local://preview?path=${encodeURIComponent(filePath)}`,
        }
      },
      detectProgram: async ({ kind, path }) => {
        if (kind === 'custom') {
          return path?.trim()
            ? { found: true, path: path.trim() }
            : { found: false, error: 'Empty path' }
        }
        return {
          found: true,
          path:
            kind === 'vscode'
              ? 'C:\\Users\\Developer\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'
              : 'C:\\mock\\Cursor.exe',
        }
      },
      openWithProgram: async () => ({ ok: true }),
      pickPrivateKey: async () => null,
    },
    terminal: {
      create: async (options) => {
        const id = `browser-mock-${++mockTermCounter}`
        const name = options.name ?? `${options.shell} (预览)`
        const envResolved = options.env
          ? Object.fromEntries(
              Object.entries(options.env).map(([k, v]) => [k, resolveVaultText(v)]),
            )
          : undefined
        void envResolved
        const mockCwd = options.cwd ?? 'C:\\Users\\Developer'
        window.setTimeout(() => emitData(id, welcomeMessage(options.shell)), 0)
        window.setTimeout(() => {
          for (const listener of cwdListeners) listener(id, mockCwd)
        }, 0)
        return { id, name, shell: options.shell, cwd: mockCwd }
      },
      write: (id, data) => {
        emitData(id, data)
      },
      resize: () => undefined,
      kill: () => undefined,
      setActiveStream: () => undefined,
      setActiveStreams: () => undefined,
      onData: (cb) => {
        dataListeners.add(cb)
        return () => dataListeners.delete(cb)
      },
      onCwd: (cb) => {
        cwdListeners.add(cb)
        return () => cwdListeners.delete(cb)
      },
      onExit: () => () => undefined,
    },
  }
}

export function installBrowserDevMockIfNeeded(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  if (typeof window.electronAPI?.settings?.get === 'function') return false

  window.electronAPI = createBrowserDevElectronAPI()
  return true
}

export function isBrowserDevPreview(): boolean {
  installBrowserDevMockIfNeeded()
  const api = window.electronAPI as BrowserDevElectronAPI | undefined
  return api?.__browserDevMock === true
}
