export type TerminalEmulator = 'xterm' | 'wterm'

type TerminalRenderer = 'dom' | 'webgl' | 'webgpu'

/** Wterm 仅支持 DOM 渲染，对应 terminal.renderer = dom */
export const WTERM_RENDERER: TerminalRenderer = 'dom'

export interface ExperimentalSettings {
  /** 终端模拟器实现：xterm（默认）或 wterm（实验） */
  terminalEmulator: TerminalEmulator
}

export const DEFAULT_EXPERIMENTAL_SETTINGS: ExperimentalSettings = {
  terminalEmulator: 'xterm',
}

export function normalizeTerminalEmulator(value: unknown): TerminalEmulator {
  return value === 'wterm' ? 'wterm' : 'xterm'
}

export function normalizeExperimentalSettings(raw: unknown): ExperimentalSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    terminalEmulator: normalizeTerminalEmulator(o.terminalEmulator),
  }
}

/** 使用 Wterm 时将渲染方式规范为 dom（不支持 Canvas/WebGL/WebGPU） */
export function normalizeRendererForWterm(
  emulator: TerminalEmulator,
  renderer: TerminalRenderer,
): TerminalRenderer {
  if (emulator === 'wterm') return WTERM_RENDERER
  return renderer
}
