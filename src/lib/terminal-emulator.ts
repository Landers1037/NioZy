import type { AppSettings } from '../../electron/shared/api-types'
import type { TerminalEmulator } from '../../electron/shared/experimental-settings'
import {
  normalizeRendererForWterm,
  WTERM_RENDERER,
} from '../../electron/shared/experimental-settings'

export { WTERM_RENDERER }

export function getTerminalEmulator(settings: AppSettings | null | undefined): TerminalEmulator {
  return settings?.experimental?.terminalEmulator ?? 'xterm'
}

export function isWtermEmulator(settings: AppSettings | null | undefined): boolean {
  return getTerminalEmulator(settings) === 'wterm'
}

export function isGhosttyEmulator(settings: AppSettings | null | undefined): boolean {
  return getTerminalEmulator(settings) === 'ghostty'
}

/** 使用 ghostty-web 或 xterm.js 的前端路径（非 Wterm） */
export function isXtermLikeEmulator(settings: AppSettings | null | undefined): boolean {
  const emulator = getTerminalEmulator(settings)
  return emulator === 'xterm' || emulator === 'ghostty'
}

/** 仅支持 DOM 渲染、不可切换 WebGL 的模拟器 */
export function isDomOnlyTerminalEmulator(settings: AppSettings | null | undefined): boolean {
  const emulator = getTerminalEmulator(settings)
  return emulator === 'wterm' || emulator === 'ghostty'
}

export function isXtermEmulator(settings: AppSettings | null | undefined): boolean {
  return getTerminalEmulator(settings) === 'xterm'
}

export function isGhosttyCoreEnabled(settings: AppSettings | null | undefined): boolean {
  return isWtermEmulator(settings) && settings?.experimental?.ghosttyCoreEnabled === true
}

export { isAttachPtyRenderMode } from '@/lib/attach-pty-render'

export const normalizeRendererForEmulator = normalizeRendererForWterm
