export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']

export const DEFAULT_LOG_FILE_NAME = 'NioZy.log'

export interface LoggingSettings {
  /** 为 true 时将主进程 console 写入日志文件 */
  enabled: boolean
  level: LogLevel
  /** 日志文件绝对路径；空字符串表示程序运行目录下的 NioZy.log */
  filePath: string
}

export const DEFAULT_LOGGING_SETTINGS: LoggingSettings = {
  enabled: false,
  level: 'INFO',
  filePath: '',
}

export function normalizeLogLevel(value: unknown): LogLevel {
  if (value === 'DEBUG' || value === 'WARN' || value === 'ERROR') return value
  return 'INFO'
}

export function normalizeLoggingSettings(
  stored: Partial<LoggingSettings> | undefined,
  legacyDebugLog?: boolean,
): LoggingSettings {
  const enabled =
    typeof stored?.enabled === 'boolean'
      ? stored.enabled
      : typeof legacyDebugLog === 'boolean'
        ? legacyDebugLog
        : DEFAULT_LOGGING_SETTINGS.enabled

  const level =
    stored?.level !== undefined
      ? normalizeLogLevel(stored.level)
      : legacyDebugLog === true
        ? 'DEBUG'
        : DEFAULT_LOGGING_SETTINGS.level

  return {
    enabled,
    level,
    filePath:
      typeof stored?.filePath === 'string'
        ? stored.filePath
        : DEFAULT_LOGGING_SETTINGS.filePath,
  }
}
