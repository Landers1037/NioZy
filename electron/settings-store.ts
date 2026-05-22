import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { BuiltinConnections, CustomConnection } from './shared/api-types'
import { ConnectionsStore, parseConnectionsFromUnknown } from './connections-store'
import { ensureConfigDir, getConfigDir, getSettingsFilePath, getTermFilePath } from './config-paths'

export type ThemeMode = 'light' | 'dark'
export type LayoutMode = 'default' | 'focus' | 'minimal'
export type TerminalRenderer = 'dom' | 'webgl' | 'webgpu'
import type { TerminalColorScheme } from './shared/terminal-color-schemes'
import { normalizeTerminalColorScheme } from './shared/terminal-color-schemes'
import {
  normalizeTerminalCursorStyle,
  type TerminalCursorStyle,
} from './shared/terminal-cursor'
import { DEFAULT_SHORTCUTS, type AppShortcuts } from './shared/shortcuts'
import {
  DEFAULT_BUILTIN_CONNECTIONS,
  normalizeBuiltinConnections,
} from './shared/builtin-shells'
import { DEFAULT_LOCALE, normalizeLocale } from './shared/locale'
import { DEFAULT_SIDEBAR_WIDTH, normalizeSidebarWidth } from './shared/sidebar-width'
import {
  normalizeDrawBoldTextInBrightColors,
  normalizeRightClickCopyPaste,
  normalizeTerminalScrollback,
  DEFAULT_TERMINAL_SCROLLBACK,
} from './shared/terminal-xterm'

export type { TerminalColorScheme } from './shared/terminal-color-schemes'

export type { CustomConnection }

export interface AppSettings {
  locale: import('./shared/locale').AppLocale
  theme: ThemeMode
  layoutMode: LayoutMode
  sidebarWidth: number
  accentColor: string
  fontSize: number
  terminal: {
    colorScheme: TerminalColorScheme
    fontFamily: string
    fontSize: number
    renderer: TerminalRenderer
    cursorStyle: TerminalCursorStyle
    cursorBlink: boolean
    scrollback: number
    drawBoldTextInBrightColors: boolean
    rightClickCopyPaste: boolean
  }
  connections: CustomConnection[]
  builtinConnections: BuiltinConnections
  system: {
    proxy: string
    launchOnStartup: boolean
    minimizeToTrayOnClose: boolean
  }
  advanced: {
    hardwareAcceleration: boolean
    /** 为 true 时 webPreferences.sandbox 为 false */
    disableSandbox: boolean
    transparency: number
    statusBarLiveStats: boolean
    /** Windows：在文件夹与目录背景右键注册「使用 NioZy 打开」 */
    shellContextMenu: boolean
  }
  shortcuts: AppShortcuts
}

/** 写入 settings.json 的字段（不含连接列表） */
export type StoredAppSettings = Omit<AppSettings, 'connections'>

function normalizeLayoutMode(value: unknown): LayoutMode {
  if (value === 'focus' || value === 'minimal') return value
  return 'default'
}

/** 启动最早阶段读取（须在 app.whenReady 之前用于 disableHardwareAcceleration） */
export function isHardwareAccelerationEnabled(): boolean {
  ensureConfigDir()
  const path = getSettingsFilePath()
  if (!existsSync(path)) return DEFAULT_SETTINGS.advanced.hardwareAcceleration
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
      advanced?: { hardwareAcceleration?: unknown }
    }
    const value = raw.advanced?.hardwareAcceleration
    return typeof value === 'boolean'
      ? value
      : DEFAULT_SETTINGS.advanced.hardwareAcceleration
  } catch {
    return DEFAULT_SETTINGS.advanced.hardwareAcceleration
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: DEFAULT_LOCALE,
  theme: 'light',
  layoutMode: 'default',
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  accentColor: '#0A84FF',
  fontSize: 13,
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
  },
  shortcuts: { ...DEFAULT_SHORTCUTS },
}

export class SettingsStore {
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private settingsPath = getSettingsFilePath()
  private readonly connectionsStore = new ConnectionsStore()

  load(): AppSettings {
    ensureConfigDir()
    this.settingsPath = getSettingsFilePath()
    this.migrateLegacyConfig()

    const connections = this.connectionsStore.load()
    const stored = this.readStoredSettings()
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      locale: normalizeLocale(stored.locale),
      layoutMode: normalizeLayoutMode(stored.layoutMode),
      sidebarWidth: normalizeSidebarWidth(stored.sidebarWidth),
      connections,
      terminal: {
        ...DEFAULT_SETTINGS.terminal,
        ...stored.terminal,
        colorScheme: normalizeTerminalColorScheme(
          stored.terminal?.colorScheme ?? DEFAULT_SETTINGS.terminal.colorScheme,
        ),
        cursorStyle: normalizeTerminalCursorStyle(stored.terminal?.cursorStyle),
        cursorBlink:
          typeof stored.terminal?.cursorBlink === 'boolean'
            ? stored.terminal.cursorBlink
            : DEFAULT_SETTINGS.terminal.cursorBlink,
        scrollback: normalizeTerminalScrollback(stored.terminal?.scrollback),
        drawBoldTextInBrightColors: normalizeDrawBoldTextInBrightColors(
          stored.terminal?.drawBoldTextInBrightColors,
        ),
        rightClickCopyPaste: normalizeRightClickCopyPaste(stored.terminal?.rightClickCopyPaste),
      },
      advanced: {
        ...DEFAULT_SETTINGS.advanced,
        ...stored.advanced,
        disableSandbox:
          typeof stored.advanced?.disableSandbox === 'boolean'
            ? stored.advanced.disableSandbox
            : DEFAULT_SETTINGS.advanced.disableSandbox,
        shellContextMenu:
          typeof stored.advanced?.shellContextMenu === 'boolean'
            ? stored.advanced.shellContextMenu
            : DEFAULT_SETTINGS.advanced.shellContextMenu,
      },
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...stored.shortcuts,
        global: { ...DEFAULT_SETTINGS.shortcuts.global, ...stored.shortcuts?.global },
        app: { ...DEFAULT_SETTINGS.shortcuts.app, ...stored.shortcuts?.app },
      },
      builtinConnections: normalizeBuiltinConnections(
        (stored as Partial<AppSettings>).builtinConnections,
      ),
    }
    this.migrateEmbeddedConnections()
    return this.settings
  }

  get(): AppSettings {
    return this.settings
  }

  getConfigDir(): string {
    return getConfigDir()
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const { connections, ...rest } = partial
    if (connections !== undefined) {
      this.settings.connections = this.connectionsStore.save(connections)
    }
    if (Object.keys(rest).length > 0) {
      this.settings = deepMerge(this.settings, rest) as AppSettings
      this.persistSettings()
    }
    return this.settings
  }

  private readStoredSettings(): Partial<StoredAppSettings> {
    if (!existsSync(this.settingsPath)) return {}
    try {
      const raw = JSON.parse(readFileSync(this.settingsPath, 'utf-8')) as Record<string, unknown>
      const { connections: _drop, ...stored } = raw
      return stored as Partial<StoredAppSettings>
    } catch {
      return {}
    }
  }

  /** 从 Electron userData 下的旧 settings.json 迁移 */
  private migrateLegacyConfig(): void {
    const legacyPath = join(app.getPath('userData'), 'settings.json')
    if (!existsSync(legacyPath)) return

    const hasNewSettings = existsSync(this.settingsPath)
    const hasTerm = existsSync(getTermFilePath())
    if (hasNewSettings && hasTerm) return

    try {
      const raw = JSON.parse(readFileSync(legacyPath, 'utf-8')) as Record<string, unknown>
      const legacyConnections = parseConnectionsFromUnknown(raw)
      const { connections: _c, ...stored } = raw

      if (!hasNewSettings) {
        writeFileSync(this.settingsPath, JSON.stringify(stored, null, 2), 'utf-8')
      }
      if (!hasTerm) {
        this.connectionsStore.save(legacyConnections)
      }
    } catch {
      // 忽略损坏的旧配置
    }
  }

  /** 新目录 settings.json 若仍内嵌 connections，拆分到 term.json */
  private migrateEmbeddedConnections(): void {
    if (!existsSync(this.settingsPath)) return
    try {
      const raw = JSON.parse(readFileSync(this.settingsPath, 'utf-8')) as Record<string, unknown>
      const embedded = parseConnectionsFromUnknown(raw)
      if (embedded.length === 0) return
      if (this.settings.connections.length === 0) {
        this.settings.connections = this.connectionsStore.save(embedded)
      }
      this.persistSettings()
    } catch {
      // 忽略
    }
  }

  private persistSettings(): void {
    ensureConfigDir()
    const { connections: _c, ...stored } = this.settings
    writeFileSync(this.settingsPath, JSON.stringify(stored, null, 2), 'utf-8')
  }
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const out = { ...target }
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key]
    const tv = target[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object') {
      out[key] = deepMerge(tv as object, sv as object) as T[keyof T]
    } else if (sv !== undefined) {
      out[key] = sv as T[keyof T]
    }
  }
  return out
}
