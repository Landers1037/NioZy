import { createWriteStream, mkdirSync, type WriteStream } from 'fs'
import { dirname, join } from 'path'
import { format } from 'node:util'
import {
  DEFAULT_LOG_FILE_NAME,
  type LogLevel,
  type LoggingSettings,
} from '../shared/logging-settings'

const LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

let logStream: WriteStream | null = null
let config: LoggingSettings = {
  enabled: false,
  level: 'INFO',
  filePath: '',
}

const originals = {
  debug: console.debug.bind(console),
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

export interface AppLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function meetsLevel(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[config.level]
}

function writeLine(level: LogLevel, args: unknown[]): void {
  if (!config.enabled || !logStream || !meetsLevel(level)) return
  try {
    logStream.write(`[${new Date().toISOString()}] [${level}] ${format(...args)}\n`)
  } catch {
    /* 避免写日志本身再抛错 */
  }
}

function emitToConsole(level: LogLevel, args: unknown[]): void {
  switch (level) {
    case 'DEBUG':
      originals.debug(...args)
      break
    case 'INFO':
      originals.log(...args)
      break
    case 'WARN':
      originals.warn(...args)
      break
    case 'ERROR':
      originals.error(...args)
      break
  }
}

function emit(level: LogLevel, args: unknown[]): void {
  emitToConsole(level, args)
  writeLine(level, args)
}

function patchConsole(): void {
  console.debug = (...args: unknown[]) => emit('DEBUG', args)
  console.log = (...args: unknown[]) => emit('INFO', args)
  console.info = (...args: unknown[]) => emit('INFO', args)
  console.warn = (...args: unknown[]) => emit('WARN', args)
  console.error = (...args: unknown[]) => emit('ERROR', args)
}

function restoreConsole(): void {
  console.debug = originals.debug
  console.log = originals.log
  console.info = originals.info
  console.warn = originals.warn
  console.error = originals.error
}

function closeLogStream(): void {
  if (!logStream) return
  logStream.end()
  logStream = null
}

function openLogStream(logPath: string): void {
  mkdirSync(dirname(logPath), { recursive: true })
  logStream = createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  logStream.write(
    `\n--- NioZy ${new Date().toISOString()} pid=${process.pid} cwd=${process.cwd()} ---\n`,
  )
}

export function createAppLogger(scope: string): AppLogger {
  const tag = `[NioZy][${scope}]`
  const prefix = (args: unknown[]): unknown[] => {
    if (args.length === 0) return [tag]
    if (typeof args[0] === 'string') return [`${tag} ${args[0]}`, ...args.slice(1)]
    return [tag, ...args]
  }
  return {
    debug: (...args) => emit('DEBUG', prefix(args)),
    info: (...args) => emit('INFO', prefix(args)),
    warn: (...args) => emit('WARN', prefix(args)),
    error: (...args) => emit('ERROR', prefix(args)),
  }
}

/** 主进程默认 logger（无子模块前缀，仅 [NioZy]） */
export const appLog: AppLogger = createAppLogger('App')

export function getDefaultLogFilePath(): string {
  return join(process.cwd(), DEFAULT_LOG_FILE_NAME)
}

export function resolveLogFilePath(filePath: string): string {
  const trimmed = filePath.trim()
  return trimmed || getDefaultLogFilePath()
}

export function isLoggingEnabled(): boolean {
  return config.enabled
}

export function getLoggingConfig(): Readonly<LoggingSettings> {
  return config
}

/** 日志已开启且配置级别允许输出该级别 */
export function shouldLogAtLevel(level: LogLevel): boolean {
  return config.enabled && meetsLevel(level)
}

export function applyLoggingSettings(next: LoggingSettings): void {
  const prev = config

  if (!next.enabled) {
    config = { ...next }
    if (!prev.enabled && !logStream) return
    restoreConsole()
    closeLogStream()
    return
  }

  const logPath = resolveLogFilePath(next.filePath)
  const pathChanged =
    prev.enabled && logStream !== null && resolveLogFilePath(prev.filePath) !== logPath

  if (pathChanged) {
    restoreConsole()
    closeLogStream()
  }

  config = { ...next }

  const opening = !logStream
  if (opening) {
    openLogStream(logPath)
    patchConsole()
    appLog.info('Logging enabled', { path: logPath, level: config.level })
  } else if (prev.level !== config.level || pathChanged) {
    appLog.debug('Logging config updated', { path: logPath, level: config.level })
  }
}

/** 将 unknown 错误格式化为可记录对象 */
export function logErrorPayload(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}
