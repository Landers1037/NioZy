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

export function isGhosttyCoreEnabled(settings: AppSettings | null | undefined): boolean {
  return isWtermEmulator(settings) && settings?.experimental?.ghosttyCoreEnabled === true
}

export { isAttachPtyRenderMode } from '@/lib/attach-pty-render'

export const normalizeRendererForEmulator = normalizeRendererForWterm
