import type { AppSettings, ElectronAPI, SystemStatsData } from '../../electron/shared/api-types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accentColor: '#0A84FF',
  fontSize: 13,
  terminal: {
    colorScheme: 'atom',
    fontFamily: 'Consolas',
    fontSize: 13,
    renderer: 'webgl',
  },
  connections: [],
  system: {
    proxy: '',
    launchOnStartup: false,
    minimizeToTrayOnClose: true,
  },
  advanced: {
    hardwareAcceleration: true,
    transparency: 100,
    statusBarLiveStats: true,
  },
}

type DataListener = (id: string, data: string) => void
type StatsListener = (stats: SystemStatsData) => void

let mockSettings: AppSettings = structuredClone(DEFAULT_SETTINGS)
let mockTermCounter = 0
const dataListeners = new Set<DataListener>()
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
    connections: partial.connections ?? mockSettings.connections,
  }
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
      get: async () => structuredClone(mockSettings),
      save: async (partial) => {
        mockSettings = mergeSettings(partial)
        return structuredClone(mockSettings)
      },
    },
    system: {
      getStats: async () => mockSystemStats(),
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
    terminal: {
      create: async (options) => {
        const id = `browser-mock-${++mockTermCounter}`
        const name = options.name ?? `${options.shell} (预览)`
        window.setTimeout(() => emitData(id, welcomeMessage(options.shell)), 0)
        return { id, name, shell: options.shell }
      },
      write: (id, data) => {
        emitData(id, data)
      },
      resize: () => undefined,
      kill: () => undefined,
      onData: (cb) => {
        dataListeners.add(cb)
        return () => dataListeners.delete(cb)
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
