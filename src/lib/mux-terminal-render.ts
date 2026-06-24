import type { AppSettings } from '../../electron/shared/api-types'
import { normalizeTerminalEmulator } from '../../electron/shared/experimental-settings'

export function isMuxCoreEnabled(settings: AppSettings | null | undefined): boolean {
  if (!settings?.experimental.muxCoreEnabled) return false
  return normalizeTerminalEmulator(settings.experimental.terminalEmulator) === 'xterm'
}

export function getMuxPaneCount(settings: AppSettings | null | undefined): 1 | 2 | 4 {
  const n = settings?.experimental.muxPaneCount
  if (n === 1 || n === 2 || n === 4) return n
  return 4
}
