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

export const normalizeRendererForEmulator = normalizeRendererForWterm
