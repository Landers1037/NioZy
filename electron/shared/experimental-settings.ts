export type TerminalEmulator = 'xterm' | 'wterm'

import type { TerminalRenderer } from './terminal-renderer'

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
}

export const DEFAULT_EXPERIMENTAL_SETTINGS: ExperimentalSettings = {
  terminalEmulator: 'xterm',
  ghosttyCoreEnabled: false,
  ghosttyScrollbackLimit: DEFAULT_GHOSTTY_SCROLLBACK_LIMIT,
  attachPtyRenderMode: false,
  attachPtyTabSwitchDwellMs: DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
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
  return {
    terminalEmulator: normalizeTerminalEmulator(o.terminalEmulator),
    ghosttyCoreEnabled: o.ghosttyCoreEnabled === true,
    ghosttyScrollbackLimit: normalizeGhosttyScrollbackLimit(o.ghosttyScrollbackLimit),
    attachPtyRenderMode: o.attachPtyRenderMode === true,
    attachPtyTabSwitchDwellMs: normalizeAttachPtyTabSwitchDwellMs(o.attachPtyTabSwitchDwellMs),
  }
}

/** 使用 Wterm 时将渲染方式规范为 dom（不支持 Canvas/WebGL） */
export function normalizeRendererForWterm(
  emulator: TerminalEmulator,
  renderer: TerminalRenderer,
): TerminalRenderer {
  if (emulator === 'wterm') return WTERM_RENDERER
  return renderer
}
