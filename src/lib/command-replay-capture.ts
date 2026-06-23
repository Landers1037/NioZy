import type { Terminal } from '@xterm/xterm'
import type { WTerm } from '@wterm/dom'
import { getTerminal } from '@/lib/terminal-registry'

type CursorLineReader = () => string | null

const wtermCursorLineReaders = new Map<string, CursorLineReader>()

export function registerWtermCursorLine(terminalId: string, read: CursorLineReader): void {
  wtermCursorLineReaders.set(terminalId, read)
}

export function unregisterWtermCursorLine(terminalId: string): void {
  wtermCursorLineReaders.delete(terminalId)
}

/** 从带提示符的终端行中提取用户输入的命令部分 */
export function extractCommandFromPromptLine(line: string): string {
  const trimmed = line.trimEnd()
  if (!trimmed) return ''

  const psMatch = trimmed.match(/^PS(?:\s+[^:]+)?>\s*(.*)$/i)
  if (psMatch) return (psMatch[1] ?? '').trimEnd()

  const genericMatch = trimmed.match(/^[^>\r\n]*>\s*(.*)$/)
  if (genericMatch) return (genericMatch[1] ?? '').trimEnd()

  // [user@host path]# cmd
  const bracketUnix = trimmed.match(/^\[[^\]]+\]\s*[#$]?\s*(.*)$/)
  if (bracketUnix) return (bracketUnix[1] ?? '').trimEnd()

  // user@host:path# cmd / user@host:path$ cmd
  const unixAt = trimmed.match(/^[^\s]*@[^:#$]*:[^#$\r\n]*[#$]\s*(.*)$/)
  if (unixAt) return (unixAt[1] ?? '').trimEnd()

  // path# cmd（无 @ 的 root 提示符等）
  const unixHash = trimmed.match(/^[^#$\r\n]*[#$]\s*(.*)$/)
  if (unixHash) return (unixHash[1] ?? '').trimEnd()

  return trimmed
}

function readXtermCursorRowText(term: Terminal): string | null {
  const buffer = term.buffer.active
  if (buffer.type === 'alternate') return null

  const y = buffer.baseY + buffer.cursorY
  const line = buffer.getLine(y)
  if (!line) return null
  return line.translateToString(true)
}

export function readWtermCursorCommandFromInstance(instance: WTerm): string | null {
  const row = readWtermCursorRowText(instance)
  return row ? extractCommandFromPromptLine(row) : null
}

function readWtermCursorRowText(instance: WTerm): string | null {
  const core = instance.bridge
  if (!core || core.usingAltScreen()) return null

  const { row } = core.getCursor()
  const cols = core.getCols()
  const chars: string[] = []
  for (let col = 0; col < cols; col++) {
    const code = core.getCell(row, col).char
    chars.push(code === 0 ? ' ' : String.fromCodePoint(code))
  }
  return chars.join('').trimEnd()
}

export function readTerminalCursorCommand(terminalId: string): string | null {
  const xterm = getTerminal(terminalId)
  if (xterm) {
    const row = readXtermCursorRowText(xterm)
    return row ? extractCommandFromPromptLine(row) : null
  }

  const wtermRead = wtermCursorLineReaders.get(terminalId)
  if (!wtermRead) return null
  return wtermRead()
}

/**
 * 用终端当前光标行的命令修正最后一行录制结果。
 * 向右键接受内联补全时往往只写入 \\x1b[C，补全文字仅出现在屏幕行上。
 */
export function mergeRecordedWithCursorLine(
  recorded: string,
  cursorCommand: string | null,
): string {
  if (!cursorCommand) return recorded

  const lines = recorded.split('\n')
  if (lines.length === 0) return cursorCommand

  const lastIndex = lines.length - 1
  const lastRecorded = lines[lastIndex] ?? ''

  const shouldReplace =
    (lastRecorded.length === 0 && cursorCommand.length > 0) ||
    (lastRecorded.length > 0 &&
      cursorCommand.length > lastRecorded.length &&
      cursorCommand.startsWith(lastRecorded))

  if (shouldReplace) {
    lines[lastIndex] = cursorCommand
  }

  return lines.join('\n')
}
