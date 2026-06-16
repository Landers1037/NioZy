export type TerminalEmulator = 'xterm' | 'wterm'

import type { TerminalRenderer } from './terminal-renderer'
import {
  DEFAULT_VNC_ENCODING,
  normalizeVncEncoding,
  type VncEncoding,
} from './vnc-settings'
import {
  DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  normalizeAiSidebarWidthPreset,
  type AiSidebarWidthPreset,
} from './ai-sidebar-width'
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
import { normalizeAiRuleStates, type AiRuleStates } from './ai-context-types'

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
  /** 在渲染进程启用基于 noVNC 的 VNC Web Viewer */
  vncWebEnabled: boolean
  /** VNC Viewer：根据右侧容器尺寸自适应缩放（scale-to-fit） */
  vncAdaptiveScale: boolean
  /** VNC Viewer：硬件加速（GPU 友好的 Canvas 渲染上下文，实验性） */
  vncHardwareAccel: boolean
  /** VNC Viewer：本地光标（客户端渲染光标；关闭则使用远程 framebuffer 光标） */
  vncLocalCursor: boolean
  /** VNC Viewer：首选画面编码格式 */
  vncEncoding: VncEncoding
  /**
   * Attach-PTY 渲染：单 Tab 共用一个 xterm 实例，切换 Tab 时 attach 不同 PTY（分屏仍多实例）。
   * 仅支持 Xterm.js。
   */
  attachPtyRenderMode: boolean
  /** Attach-PTY：Tab 停留多久（ms）后才 attach / 恢复终端内容 */
  attachPtyTabSwitchDwellMs: number
  /** Attach-PTY：单例宿主复用 WebGL 上下文槽位，Tab 切换时不随 terminalId 释放 */
  attachPtyWebglContextPool: boolean
  /** Attach-PTY：detach 时将 scrollback 卸载到侧存储，减轻 xterm 内存占用 */
  attachPtyScrollbackOffload: boolean
  /** 开启 AI 对话边栏 */
  aiSidebarEnabled: boolean
  /** AI 边栏支持附加本地图片/文件 */
  aiAttachmentsEnabled: boolean
  /** AI 边栏宽度预设 */
  aiSidebarWidth: AiSidebarWidthPreset
  /** 本机 Copilot Runtime 监听端口 */
  aiRuntimePort: number
  /** AI 提供商 */
  aiProvider: AiProvider
  /** AI 模型 */
  aiModel: string
  /** AI API Base URL */
  aiBaseUrl: string
  /** AI API Key；可为明文或存储库引用如 ${OPENAI_API_KEY} */
  aiApiKey: string
  /** 已启用规则 id → true；未列入或 false 表示不注入对话上下文 */
  aiRuleStates: AiRuleStates
  /** @deprecated 迁移至 aiApiKey */
  openAiApiKey?: string
  /** 启用 JS 沙箱（QuickJS WASM） */
  jsSandboxEnabled: boolean
}

export const DEFAULT_EXPERIMENTAL_SETTINGS: ExperimentalSettings = {
  terminalEmulator: 'xterm',
  ghosttyCoreEnabled: false,
  ghosttyScrollbackLimit: DEFAULT_GHOSTTY_SCROLLBACK_LIMIT,
  vncWebEnabled: false,
  vncAdaptiveScale: true,
  vncHardwareAccel: false,
  vncLocalCursor: true,
  vncEncoding: DEFAULT_VNC_ENCODING,
  attachPtyRenderMode: false,
  attachPtyTabSwitchDwellMs: DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  attachPtyWebglContextPool: false,
  attachPtyScrollbackOffload: false,
  aiSidebarEnabled: false,
  aiAttachmentsEnabled: false,
  aiSidebarWidth: DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  aiRuntimePort: DEFAULT_AI_RUNTIME_PORT,
  aiProvider: DEFAULT_AI_PROVIDER,
  aiModel: DEFAULT_AI_MODEL,
  aiBaseUrl: normalizeAiBaseUrl(DEFAULT_AI_PROVIDER, undefined),
  aiApiKey: '',
  aiRuleStates: {},
  jsSandboxEnabled: false,
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
    vncWebEnabled: o.vncWebEnabled === true,
    vncAdaptiveScale: o.vncAdaptiveScale !== false,
    vncHardwareAccel: o.vncHardwareAccel === true,
    vncLocalCursor: o.vncLocalCursor !== false,
    vncEncoding: normalizeVncEncoding(o.vncEncoding),
    attachPtyRenderMode: o.attachPtyRenderMode === true,
    attachPtyTabSwitchDwellMs: normalizeAttachPtyTabSwitchDwellMs(o.attachPtyTabSwitchDwellMs),
    attachPtyWebglContextPool: o.attachPtyWebglContextPool === true,
    attachPtyScrollbackOffload: o.attachPtyScrollbackOffload === true,
    aiSidebarEnabled: o.aiSidebarEnabled === true,
    aiAttachmentsEnabled: o.aiAttachmentsEnabled === true,
    aiSidebarWidth: normalizeAiSidebarWidthPreset(o.aiSidebarWidth),
    aiRuntimePort: normalizeAiRuntimePort(o.aiRuntimePort),
    aiProvider: provider,
    aiModel: normalizeAiModel(provider, o.aiModel),
    aiBaseUrl: normalizeAiBaseUrl(provider, o.aiBaseUrl),
    aiApiKey,
    aiRuleStates: normalizeAiRuleStates(o.aiRuleStates),
    jsSandboxEnabled: o.jsSandboxEnabled === true,
  }
}

export {
  buildAiRuntimeConfig,
  resolveAiRuntimeConfig,
  sanitizeResolvedAiRuntimeConfig,
  warnIfAiApiKeyUnresolved,
  type AiProvider,
} from './ai-provider-settings'

export { normalizeAiRuleStates, type AiRuleStates } from './ai-context-types'
export type { AiRuleSummary, AiSkillSummary, AiChatContextPayload } from './ai-context-types'

export {
  AI_SIDEBAR_WIDTH_PRESETS,
  AI_SIDEBAR_WIDTH_PX,
  DEFAULT_AI_SIDEBAR_WIDTH_PRESET,
  normalizeAiSidebarWidthPreset,
  resolveAiSidebarWidthPx,
  type AiSidebarWidthPreset,
} from './ai-sidebar-width'

/** 使用 Wterm 时将渲染方式规范为 dom（不支持 Canvas/WebGL） */
export function normalizeRendererForWterm(
  emulator: TerminalEmulator,
  renderer: TerminalRenderer,
): TerminalRenderer {
  if (emulator === 'wterm') return WTERM_RENDERER
  return renderer
}
