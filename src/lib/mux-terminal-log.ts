import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { devDebug, devInfo } from '../../electron/shared/dev-log'

const PREFIX = '[NioZy][MuxView]'

function forward(level: 'info' | 'debug', message: string, detail?: Record<string, unknown>): void {
  if (level === 'info') {
    devInfo(PREFIX, message, detail ?? '')
  } else {
    devDebug(PREFIX, message, detail ?? '')
  }
  if (!isElectron()) return
  try {
    getElectronAPI().muxTerminal.debugLog(level, message, detail)
  } catch {
    /* preload 未就绪时忽略 */
  }
}

export const muxTerminalLog = {
  info: (message: string, detail?: Record<string, unknown>) => forward('info', message, detail),
  debug: (message: string, detail?: Record<string, unknown>) => forward('debug', message, detail),
}
