import type { AppSettings } from '../../electron/shared/api-types'
import { isWtermEmulator } from '@/lib/terminal-emulator'

/** DECSET/DECRST synchronized output (DEC private mode 2026) */
const SYNC_OUTPUT_TOGGLE = /\x1b\[\?2026[hl]/g

export function isSynchronizedOutputEnabled(settings: AppSettings | null | undefined): boolean {
  if (!settings || isWtermEmulator(settings)) return false
  return settings.terminal.synchronizedOutputEnabled !== false
}

/** 关闭同步输出时剥离 BSU/ESU，使 xterm 即时渲染 */
export function filterSynchronizedOutputSequences(data: string, enabled: boolean): string {
  if (enabled) return data
  return data.replace(SYNC_OUTPUT_TOGGLE, '')
}

export function writeXtermOutput(
  term: { write: (data: string, callback?: () => void) => void },
  data: string,
  settings: AppSettings | null | undefined,
  callback?: () => void,
): void {
  term.write(
    filterSynchronizedOutputSequences(data, isSynchronizedOutputEnabled(settings)),
    callback,
  )
}
