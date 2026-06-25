import type { AppSettings } from '../../electron/shared/api-types'
import { normalizeTerminalEmulator } from '../../electron/shared/experimental-settings'

export function isMuxCoreEnabled(settings: AppSettings | null | undefined): boolean {
  if (!settings?.experimental.muxCoreEnabled) return false
  return normalizeTerminalEmulator(settings.experimental.terminalEmulator) === 'xterm'
}
