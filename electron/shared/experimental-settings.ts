export type TerminalEmulator = 'xterm' | 'wterm' | 'ghostty'

import type { TerminalRenderer } from './terminal-renderer'
import {
  DEFAULT_VNC_ENCODING,
  normalizeVncEncoding,
  type VncEncoding,
} from './vnc-settings'
import { normalizeMuxPaneCount } from './mux-terminal-types'

/** Wterm 仅支持 DOM 渲染，对应 terminal.renderer = dom */
export const WTERM_RENDERER: TerminalRenderer = 'dom'

export const DEFAULT_GHOSTTY_SCROLLBACK_LIMIT = 10_000
export const MIN_GHOSTTY_SCROLLBACK_LIMIT = 1_000
export const MAX_GHOSTTY_SCROLLBACK_LIMIT = 50_000

export const DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 300
export const MIN_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 0
export const MAX_ATTACH_PTY_TAB_SWITCH_DWELL_MS = 5_000

export interface ExperimentalSettings {
  /** 终端模拟器实现：xterm（默认）、ghostty（ghostty-web）或 wterm（实验） */
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
  /**
   * NioZy Mux Core：本地 PTY 合成屏（单 xterm 渲染 1/2/4 pane）。
   * 与 Attach-PTY、Ghostty/Wterm 互斥；SSH 不支持。
   */
  muxCoreEnabled: boolean
  /** Mux 合成屏默认 pane 数：1、2 或 4 */
  muxPaneCount: 1 | 2 | 4
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
  muxCoreEnabled: false,
  muxPaneCount:
    typeof process !== 'undefined' && process.platform === 'win32' ? 1 : 4,
  jsSandboxEnabled: false,
}

export function normalizeTerminalEmulator(value: unknown): TerminalEmulator {
  if (value === 'wterm') return 'wterm'
  if (value === 'ghostty') return 'ghostty'
  return 'xterm'
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
    vncWebEnabled: o.vncWebEnabled === true,
    vncAdaptiveScale: o.vncAdaptiveScale !== false,
    vncHardwareAccel: o.vncHardwareAccel === true,
    vncLocalCursor: o.vncLocalCursor !== false,
    vncEncoding: normalizeVncEncoding(o.vncEncoding),
    attachPtyRenderMode: o.attachPtyRenderMode === true,
    attachPtyTabSwitchDwellMs: normalizeAttachPtyTabSwitchDwellMs(o.attachPtyTabSwitchDwellMs),
    attachPtyWebglContextPool: o.attachPtyWebglContextPool === true,
    attachPtyScrollbackOffload: o.attachPtyScrollbackOffload === true,
    muxCoreEnabled: o.muxCoreEnabled === true,
    muxPaneCount: normalizeMuxPaneCount(o.muxPaneCount),
    jsSandboxEnabled: o.jsSandboxEnabled === true,
  }
}

/** Wterm / ghostty-web 仅支持 DOM 渲染（不支持 xterm WebGL） */
export function normalizeRendererForWterm(
  emulator: TerminalEmulator,
  renderer: TerminalRenderer,
): TerminalRenderer {
  if (emulator === 'wterm' || emulator === 'ghostty') return WTERM_RENDERER
  return renderer
}
