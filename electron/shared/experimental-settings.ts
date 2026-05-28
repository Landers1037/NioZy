export type TerminalEmulator = 'xterm' | 'wterm'

import type { TerminalRenderer } from './terminal-renderer'
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_RUNTIME_PORT,
  normalizeAiApiKey,
  normalizeAiBaseUrl,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeAiRuntimePort,
  type AiProvider,
} from './ai-provider-settings'

/** Wterm 仅支持 DOM 渲染，对应 terminal.renderer = dom */
export const WTERM_RENDERER: TerminalRenderer = 'dom'

export const DEFAULT_GHOSTTY_SCROLLBACK_LIMIT = 10_000
export const MIN_GHOSTTY_SCROLLBACK_LIMIT = 1_000
export const MAX_GHOSTTY_SCROLLBACK_LIMIT = 50_000

export const DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 300
export const MIN_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 0
export const MAX_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 5_000

export interface ExperimentalSettings {
  /** 终端模拟器实现：xterm（默认）或 wterm（实验） */
  terminalEmulator: TerminalEmulator
  /** Wterm 下使用 @wterm/ghostty 作为 VT 解析核心（libghostty WASM） */
  ghosttyCoreEnabled: boolean
  /** Ghostty Core 回滚缓冲行数上限 */
  ghosttyScrollbackLimit: number
  /**
   * Attach-PTY 渲染：单 Tab 共用一个 xterm 实例，切换 Tab 时 attach 不同 PTY（分屏仍多实例）。
   * 仅支持 Xterm.js。
   */
  attachPtyRenderMode: boolean
  /** Attach-PTY：Tab 停留多久（ms）后才 attach / 恢复终端内容 */
  attachPtyTabSwitchDwellMs: number
  /** 开启 AI 对话边栏 */
  aiSidebarEnabled: boolean
  /** 本机 Copilot Runtime 监听端口 */
  aiRuntimePort: number
  /** AI 提供商 */
  aiProvider: AiProvider
  /** AI 模型 */
  aiModel: string
  /** AI API Base URL */
  aiBaseUrl: string
  /** AI API Key（明文存于 settings.json） */
  aiApiKey: string
  /** @deprecated 迁移至 aiApiKey */
  openAiApiKey?: string
}

export const DEFAULT_EXPERIMENTAL_SETTINGS: ExperimentalSettings = {
  terminalEmulator: 'xterm',
  ghosttyCoreEnabled: false,
  ghosttyScrollbackLimit: DEFAULT_GHOSTTY_SCROLLBACK_LIMIT,
  attachPtyRenderMode: false,
  attachPtyTabSwitchDwellMs: DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  aiSidebarEnabled: false,
  aiRuntimePort: DEFAULT_AI_RUNTIME_PORT,
  aiProvider: DEFAULT_AI_PROVIDER,
  aiModel: DEFAULT_AI_MODEL,
  aiBaseUrl: normalizeAiBaseUrl(DEFAULT_AI_PROVIDER, undefined),
  aiApiKey: '',
}

export function normalizeTerminalEmulator(value: unknown): TerminalEmulator {
  return value === 'wterm' ? 'wterm' : 'xterm'
}

export function normalizeAttachPtyTabSwitchDwellMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS
  return Math.min(
    MAX_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
    Math.max(MIN_ATTACH_PTY_TAB_SWITCH_DWELL_MS, Math.round(n)),
  )
}

export function normalizeGhosttyScrollbackLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_GHOSTTY_SCROLLBACK_LIMIT
  return Math.min(
    MAX_GHOSTTY_SCROLLBACK_LIMIT,
    Math.max(MIN_GHOSTTY_SCROLLBACK_LIMIT, Math.round(n)),
  )
}

export function normalizeExperimentalSettings(raw: unknown): ExperimentalSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const provider = normalizeAiProvider(o.aiProvider)
  const legacyApiKey = normalizeAiApiKey(o.openAiApiKey)
  const aiApiKey = normalizeAiApiKey(o.aiApiKey) || legacyApiKey
  return {
    terminalEmulator: normalizeTerminalEmulator(o.terminalEmulator),
    ghosttyCoreEnabled: o.ghosttyCoreEnabled === true,
    ghosttyScrollbackLimit: normalizeGhosttyScrollbackLimit(o.ghosttyScrollbackLimit),
    attachPtyRenderMode: o.attachPtyRenderMode === true,
    attachPtyTabSwitchDwellMs: normalizeAttachPtyTabSwitchDwellMs(o.attachPtyTabSwitchDwellMs),
    aiSidebarEnabled: o.aiSidebarEnabled === true,
    aiRuntimePort: normalizeAiRuntimePort(o.aiRuntimePort),
    aiProvider: provider,
    aiModel: normalizeAiModel(provider, o.aiModel),
    aiBaseUrl: normalizeAiBaseUrl(provider, o.aiBaseUrl),
    aiApiKey,
  }
}

export { buildAiRuntimeConfig, type AiProvider } from './ai-provider-settings'

/** 使用 Wterm 时将渲染方式规范为 dom（不支持 Canvas/WebGL） */
export function normalizeRendererForWterm(
  emulator: TerminalEmulator,
  renderer: TerminalRenderer,
): TerminalRenderer {
  if (emulator === 'wterm') return WTERM_RENDERER
  return renderer
}
