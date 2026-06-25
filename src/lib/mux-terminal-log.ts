import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { devInfo } from '../../electron/shared/dev-log'

const PREFIX = '[NioZy][MuxView]'

function forward(message: string, detail?: Record<string, unknown>): void {
  devInfo(PREFIX, message, detail ?? '')
  if (!isElectron()) return
  try {
    getElectronAPI().muxTerminal.debugLog('info', message, detail)
  } catch {
    /* preload 未就绪时忽略 */
  }
}

export const muxTerminalLog = {
  info: (message: string, detail?: Record<string, unknown>) => forward(message, detail),
}
