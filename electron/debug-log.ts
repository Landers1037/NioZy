import { createWriteStream, type WriteStream } from 'fs'
import { format } from 'node:util'
import { join } from 'path'

const LOG_FILE_NAME = 'NioZy.log'

let logStream: WriteStream | null = null
let enabled = false

const originals = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
}

function getLogFilePath(): string {
  return join(process.cwd(), LOG_FILE_NAME)
}

function writeLine(level: string, args: unknown[]): void {
  if (!logStream) return
  try {
    logStream.write(`[${new Date().toISOString()}] [${level}] ${format(...args)}\n`)
  } catch {
    /* 避免写日志本身再抛错 */
  }
}

function wrap(
  level: string,
  original: (...args: unknown[]) => void,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    original(...args)
    if (enabled) writeLine(level, args)
  }
}

function patchConsole(): void {
  console.log = wrap('LOG', originals.log)
  console.warn = wrap('WARN', originals.warn)
  console.error = wrap('ERROR', originals.error)
  console.info = wrap('INFO', originals.info)
  console.debug = wrap('DEBUG', originals.debug)
}

function restoreConsole(): void {
  console.log = originals.log
  console.warn = originals.warn
  console.error = originals.error
  console.info = originals.info
  console.debug = originals.debug
}

export function getDebugLogFilePath(): string {
  return getLogFilePath()
}

export function isDebugLogEnabled(): boolean {
  return enabled
}

/** 根据设置开启/关闭：将主进程 console 输出追加到 cwd/NioZy.log */
export function setDebugLogEnabled(value: boolean): void {
  if (value === enabled) return

  if (!value) {
    restoreConsole()
    if (logStream) {
      try {
        logStream.write(`[${new Date().toISOString()}] [INFO] Debug log disabled\n`)
      } catch {
        /* ignore */
      }
      logStream.end()
      logStream = null
    }
    enabled = false
    originals.log('[NioZy] Debug log disabled')
    return
  }

  enabled = true
  const logPath = getLogFilePath()
  logStream = createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  logStream.write(
    `\n--- NioZy debug ${new Date().toISOString()} pid=${process.pid} cwd=${process.cwd()} ---\n`,
  )
  patchConsole()
  console.log('[NioZy] Debug log enabled:', logPath)
}
