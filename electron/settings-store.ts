import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { BuiltinConnections, CustomConnection } from './shared/api-types'
import { ConnectionsStore, parseConnectionsFromUnknown } from './connections-store'
import { ensureConfigDir, getConfigDir, getSettingsFilePath, getTermFilePath } from './config-paths'
import {
  normalizeTerminalBackgroundImageExt,
  normalizeTerminalBackgroundOpacity,
  DEFAULT_TERMINAL_BACKGROUND_OPACITY,
} from './shared/terminal-background-settings'

export type ThemeMode = 'light' | 'dark'
export type LayoutMode = 'default' | 'focus' | 'minimal'
export type { UiStyle } from './shared/ui-style'
import { normalizeUiStyle } from './shared/ui-style'
export type { TerminalRenderer } from './shared/terminal-renderer'
import { normalizeTerminalRenderer, type TerminalRenderer } from './shared/terminal-renderer'
import {
  DEFAULT_TERMINAL_BUILTIN_FONT,
  normalizeTerminalBuiltinFont,
} from './shared/terminal-builtin-fonts'
import type { TerminalColorScheme } from './shared/terminal-color-schemes'
import { normalizeTerminalColorScheme } from './shared/terminal-color-schemes'
import {
  normalizeTerminalCursorStyle,
  type TerminalCursorStyle,
} from './shared/terminal-cursor'
import { DEFAULT_SHORTCUTS, type AppShortcuts } from './shared/shortcuts'
import { DEFAULT_SSH_SETTINGS, normalizeSshSettings } from './shared/ssh-settings'
import { DEFAULT_SHELL_SETTINGS, normalizeShellSettings } from './shared/shell-settings'
import {
  DEFAULT_PERFORMANCE_SETTINGS,
  normalizePerformanceSettings,
} from './shared/performance-settings'
import {
  DEFAULT_FILESYSTEM_SETTINGS,
  normalizeFilesystemSettings,
} from './shared/filesystem-settings'
import {
  DEFAULT_BUILTIN_CONNECTIONS,
  normalizeBuiltinConnections,
  normalizeDefaultTerminal,
} from './shared/builtin-shells'
import { DEFAULT_LOCALE, normalizeLocale } from './shared/locale'
import { DEFAULT_SIDEBAR_WIDTH, normalizeSidebarWidth } from './shared/sidebar-width'
import {
  normalizeDrawBoldTextInBrightColors,
  normalizeRightClickCopyPaste,
  normalizeSynchronizedOutputEnabled,
  normalizeTerminalScrollback,
  DEFAULT_TERMINAL_SCROLLBACK,
} from './shared/terminal-xterm'
import {
  normalizeSavedWindowState,
  type SavedWindowState,
} from './shared/window-state'
import {
  DEFAULT_EXPERIMENTAL_SETTINGS,
  normalizeExperimentalSettings,
  normalizeRendererForWterm,
} from './shared/experimental-settings'
import {
  DEFAULT_PREVIEW_SETTINGS,
  normalizePreviewSettings,
} from './shared/preview-settings'
import {
  DEFAULT_LOGGING_SETTINGS,
  normalizeLoggingSettings,
} from './shared/logging-settings'
import {
  DEFAULT_USAGE_STATISTICS_SETTINGS,
  normalizeUsageStatisticsSettings,
} from './shared/usage-statistics-settings'
import { DEFAULT_P2P_SETTINGS, normalizeP2pSettings } from './shared/p2p-settings'
import {
  DEFAULT_REMINDER_SETTINGS,
  normalizeReminderSettings,
} from './shared/reminder-settings'
import {
  DEFAULT_ASSISTIVE_SETTINGS,
  normalizeAssistiveSettings,
} from './shared/assistive-settings'

export type { SavedWindowState } from './shared/window-state'

export type { TerminalColorScheme } from './shared/terminal-color-schemes'

export type { CustomConnection }

export interface AppSettings {
  locale: import('./shared/locale').AppLocale
  theme: ThemeMode
  uiStyle: import('./shared/ui-style').UiStyle
  layoutMode: LayoutMode
  sidebarWidth: number
  accentColor: string
  fontSize: number
  fontWeight?: number
  fontWeightBold?: number
  showAppTitle: boolean
  enableDialogAnimations: boolean
  terminal: {
    colorScheme: TerminalColorScheme
    fontFamily: string
    useBuiltinFont: boolean
    builtinFont: import('./shared/terminal-builtin-fonts').TerminalBuiltinFontId
    fontSize: number
    fontWeight?: number
    fontWeightBold?: number
    renderer: TerminalRenderer
    cursorStyle: TerminalCursorStyle
    cursorBlink: boolean
    scrollback: number
    drawBoldTextInBrightColors: boolean
    rightClickCopyPaste: boolean
    synchronizedOutputEnabled: boolean
    backgroundImageExt?: string
    backgroundOpacity: number
  }
  connections: CustomConnection[]
  builtinConnections: BuiltinConnections
  defaultTerminal: import('./shared/builtin-shells').BuiltinShellType
  system: {
    proxy: string
    launchOnStartup: boolean
    minimizeToTrayOnClose: boolean
  }
  advanced: {
    hardwareAcceleration: boolean
    /** 为 true 时在 Chromium 启用 WebGPU（须同时开启硬件加速） */
    webGpuAcceleration: boolean
    /** 为 true 时 webPreferences.sandbox 为 false */
    disableSandbox: boolean
    transparency: number
    statusBarLiveStats: boolean
    /** Windows：在文件夹与目录背景右键注册「使用 NioZy 打开」 */
    shellContextMenu: boolean
    /** 关闭窗口时记住大小与位置，下次启动恢复 */
    preserveWindowBounds: boolean
    /** preserveWindowBounds 为 true 时由主进程写入 */
    lastWindowState?: SavedWindowState
  }
  logging: import('./shared/logging-settings').LoggingSettings
  shortcuts: AppShortcuts
  ssh: import('./shared/ssh-settings').SshSettings
  shell: import('./shared/shell-settings').ShellSettings
  performance: import('./shared/performance-settings').PerformanceSettings
  filesystem: import('./shared/filesystem-settings').FilesystemSettings
  preview: import('./shared/preview-settings').PreviewSettings
  experimental: import('./shared/experimental-settings').ExperimentalSettings
  statistics: import('./shared/usage-statistics-settings').UsageStatisticsSettings
  p2p: import('./shared/p2p-settings').P2pSettings
  reminder: import('./shared/reminder-settings').ReminderSettings
  assistive: import('./shared/assistive-settings').AssistiveSettings
}

/** 写入 settings.json 的字段（不含连接列表） */
export type StoredAppSettings = Omit<AppSettings, 'connections'>

function normalizeLayoutMode(value: unknown): LayoutMode {
  if (value === 'focus' || value === 'minimal') return value
  return 'default'
}

function readAdvancedFlagFromDisk(
  key: 'hardwareAcceleration' | 'webGpuAcceleration',
): boolean {
  ensureConfigDir()
  const path = getSettingsFilePath()
  const fallback = DEFAULT_SETTINGS.advanced[key]
  if (!existsSync(path)) return fallback
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
      advanced?: Partial<Record<typeof key, unknown>>
    }
    const value = raw.advanced?.[key]
    return typeof value === 'boolean' ? value : fallback
  } catch {
    return fallback
  }
}

/** 启动最早阶段读取（须在 app.whenReady 之前用于 disableHardwareAcceleration） */
export function isHardwareAccelerationEnabled(): boolean {
  return readAdvancedFlagFromDisk('hardwareAcceleration')
}

/** 启动最早阶段读取（须在 app.whenReady 之前；仅在硬件加速开启时生效） */
export function isWebGpuAccelerationEnabled(): boolean {
  if (!isHardwareAccelerationEnabled()) return false
  return readAdvancedFlagFromDisk('webGpuAcceleration')
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: DEFAULT_LOCALE,
  theme: 'light',
  uiStyle: 'minimal',
  layoutMode: 'default',
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  accentColor: '#5C6B7A',
  fontSize: 13,
  showAppTitle: true,
  enableDialogAnimations: true,
  terminal: {
    colorScheme: 'atom',
    fontFamily: 'Consolas',
    useBuiltinFont: false,
    builtinFont: DEFAULT_TERMINAL_BUILTIN_FONT,
    fontSize: 13,
    renderer: 'webgl',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: DEFAULT_TERMINAL_SCROLLBACK,
    drawBoldTextInBrightColors: true,
    rightClickCopyPaste: true,
    synchronizedOutputEnabled: true,
    backgroundOpacity: DEFAULT_TERMINAL_BACKGROUND_OPACITY,
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
    webGpuAcceleration: false,
    disableSandbox: true,
    transparency: 100,
    statusBarLiveStats: true,
    shellContextMenu: false,
    preserveWindowBounds: false,
  },
  logging: { ...DEFAULT_LOGGING_SETTINGS },
  shortcuts: { ...DEFAULT_SHORTCUTS },
  ssh: { ...DEFAULT_SSH_SETTINGS },
  shell: { ...DEFAULT_SHELL_SETTINGS },
  performance: { ...DEFAULT_PERFORMANCE_SETTINGS },
  filesystem: { ...DEFAULT_FILESYSTEM_SETTINGS },
  preview: { ...DEFAULT_PREVIEW_SETTINGS },
  experimental: { ...DEFAULT_EXPERIMENTAL_SETTINGS },
  statistics: { ...DEFAULT_USAGE_STATISTICS_SETTINGS },
  p2p: { ...DEFAULT_P2P_SETTINGS },
  reminder: { ...DEFAULT_REMINDER_SETTINGS },
  assistive: { ...DEFAULT_ASSISTIVE_SETTINGS },
}

function buildAppSettingsFromStored(
  stored: Partial<StoredAppSettings>,
  connections: CustomConnection[],
): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    locale: normalizeLocale(stored.locale),
    uiStyle: normalizeUiStyle(stored.uiStyle),
    layoutMode: normalizeLayoutMode(stored.layoutMode),
    sidebarWidth: normalizeSidebarWidth(stored.sidebarWidth),
    fontWeight: normalizeFontWeight((stored as Partial<AppSettings>).fontWeight),
    fontWeightBold: normalizeFontWeight((stored as Partial<AppSettings>).fontWeightBold),
    showAppTitle:
      typeof stored.showAppTitle === 'boolean'
        ? stored.showAppTitle
        : DEFAULT_SETTINGS.showAppTitle,
    enableDialogAnimations:
      typeof stored.enableDialogAnimations === 'boolean'
        ? stored.enableDialogAnimations
        : DEFAULT_SETTINGS.enableDialogAnimations,
    connections,
    terminal: {
      ...DEFAULT_SETTINGS.terminal,
      ...stored.terminal,
      colorScheme: normalizeTerminalColorScheme(
        stored.terminal?.colorScheme ?? DEFAULT_SETTINGS.terminal.colorScheme,
      ),
      fontWeight: normalizeFontWeight(
        (stored.terminal as { fontWeight?: unknown } | undefined)?.fontWeight,
      ),
      fontWeightBold: normalizeFontWeight(
        (stored.terminal as { fontWeightBold?: unknown } | undefined)?.fontWeightBold,
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
      synchronizedOutputEnabled: normalizeSynchronizedOutputEnabled(
        stored.terminal?.synchronizedOutputEnabled,
      ),
      useBuiltinFont:
        typeof stored.terminal?.useBuiltinFont === 'boolean'
          ? stored.terminal.useBuiltinFont
          : DEFAULT_SETTINGS.terminal.useBuiltinFont,
      builtinFont: normalizeTerminalBuiltinFont(stored.terminal?.builtinFont),
      renderer: normalizeTerminalRenderer(stored.terminal?.renderer),
      backgroundImageExt: normalizeTerminalBackgroundImageExt(stored.terminal?.backgroundImageExt),
      backgroundOpacity: normalizeTerminalBackgroundOpacity(
        stored.terminal?.backgroundOpacity ?? DEFAULT_SETTINGS.terminal.backgroundOpacity,
      ),
    },
    advanced: {
      ...DEFAULT_SETTINGS.advanced,
      ...stored.advanced,
      hardwareAcceleration:
        typeof stored.advanced?.hardwareAcceleration === 'boolean'
          ? stored.advanced.hardwareAcceleration
          : DEFAULT_SETTINGS.advanced.hardwareAcceleration,
      webGpuAcceleration: (() => {
        const hardwareAcceleration =
          typeof stored.advanced?.hardwareAcceleration === 'boolean'
            ? stored.advanced.hardwareAcceleration
            : DEFAULT_SETTINGS.advanced.hardwareAcceleration
        if (!hardwareAcceleration) return false
        return typeof stored.advanced?.webGpuAcceleration === 'boolean'
          ? stored.advanced.webGpuAcceleration
          : DEFAULT_SETTINGS.advanced.webGpuAcceleration
      })(),
      disableSandbox:
        typeof stored.advanced?.disableSandbox === 'boolean'
          ? stored.advanced.disableSandbox
          : DEFAULT_SETTINGS.advanced.disableSandbox,
      shellContextMenu:
        typeof stored.advanced?.shellContextMenu === 'boolean'
          ? stored.advanced.shellContextMenu
          : DEFAULT_SETTINGS.advanced.shellContextMenu,
      preserveWindowBounds:
        typeof stored.advanced?.preserveWindowBounds === 'boolean'
          ? stored.advanced.preserveWindowBounds
          : DEFAULT_SETTINGS.advanced.preserveWindowBounds,
      lastWindowState: normalizeSavedWindowState(stored.advanced?.lastWindowState),
    },
    logging: normalizeLoggingSettings(
      stored.logging,
      typeof (stored.advanced as unknown as { debugLog?: unknown } | undefined)?.debugLog ===
        'boolean'
        ? (stored.advanced as unknown as { debugLog: boolean }).debugLog
        : undefined,
    ),
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...stored.shortcuts,
      global: { ...DEFAULT_SETTINGS.shortcuts.global, ...stored.shortcuts?.global },
      app: { ...DEFAULT_SETTINGS.shortcuts.app, ...stored.shortcuts?.app },
    },
    ssh: normalizeSshSettings(stored.ssh),
    shell: normalizeShellSettings(
      stored.shell ??
        (stored.ssh && typeof stored.ssh === 'object'
          ? (stored.ssh as { shell?: unknown }).shell
          : undefined),
    ),
    performance: normalizePerformanceSettings(stored.performance, stored.shell),
    filesystem: normalizeFilesystemSettings(stored.filesystem),
    preview: normalizePreviewSettings(stored.preview),
    builtinConnections: normalizeBuiltinConnections(
      (stored as Partial<AppSettings>).builtinConnections,
    ),
    defaultTerminal: normalizeDefaultTerminal(
      (stored as Partial<AppSettings>).defaultTerminal,
    ),
    experimental: normalizeExperimentalSettings(stored.experimental),
    statistics: normalizeUsageStatisticsSettings(stored.statistics),
    p2p: normalizeP2pSettings(stored.p2p),
    reminder: normalizeReminderSettings(stored.reminder),
    assistive: normalizeAssistiveSettings((stored as Partial<AppSettings>).assistive),
  }
}

function parseSettingsExportBody(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('INVALID_FORMAT')
  }
  const raw = data as Record<string, unknown>
  if (
    raw.settings &&
    typeof raw.settings === 'object' &&
    !Array.isArray(raw.settings)
  ) {
    return raw.settings as Record<string, unknown>
  }
  return raw
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
    this.settings = buildAppSettingsFromStored(stored, connections)
    this.normalizeTerminalRendererIfNeeded()
    this.migrateEmbeddedConnections()
    return this.settings
  }

  /** 从导出的 JSON 对象导入并覆盖当前配置（含自定义连接） */
  importFromExport(data: unknown): AppSettings {
    const body = parseSettingsExportBody(data)
    const connections = this.connectionsStore.save(parseConnectionsFromUnknown(body))
    const { connections: _drop, ...rest } = body
    this.settings = buildAppSettingsFromStored(rest as Partial<StoredAppSettings>, connections)
    this.normalizeTerminalRendererIfNeeded()
    this.persistSettings()
    return this.settings
  }

  private normalizeTerminalRendererIfNeeded(): void {
    const normalizedRenderer = normalizeRendererForWterm(
      this.settings.experimental.terminalEmulator,
      this.settings.terminal.renderer,
    )
    if (normalizedRenderer !== this.settings.terminal.renderer) {
      this.settings.terminal.renderer = normalizedRenderer
      this.persistSettings()
    }
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
      if (rest.terminal?.renderer !== undefined) {
        this.settings.terminal.renderer = normalizeTerminalRenderer(
          this.settings.terminal.renderer,
        )
      }
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

function normalizeFontWeight(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  const rounded = Math.round(n)
  if (rounded < 100 || rounded > 900) return undefined
  return rounded
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const out = { ...target }
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key]
    if (sv === undefined) {
      delete (out as Record<string, unknown>)[key as string]
      continue
    }
    const tv = target[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object') {
      out[key] = deepMerge(tv as object, sv as object) as T[keyof T]
    } else {
      out[key] = sv as T[keyof T]
    }
  }
  return out
}
