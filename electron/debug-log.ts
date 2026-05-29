/** @deprecated 请从 ./app-log 导入 */
export {
  applyLoggingSettings,
  appLog,
  createAppLogger,
  getDefaultLogFilePath,
  isLoggingEnabled,
  resolveLogFilePath,
  shouldLogAtLevel,
  type AppLogger,
} from './app-log'

import { applyLoggingSettings, isLoggingEnabled, resolveLogFilePath } from './app-log'

export function getDebugLogFilePath(): string {
  return resolveLogFilePath('')
}

export function isDebugLogEnabled(): boolean {
  return isLoggingEnabled()
}

export function setDebugLogEnabled(value: boolean): void {
  applyLoggingSettings({
    enabled: value,
    level: value ? 'DEBUG' : 'INFO',
    filePath: '',
  })
}
