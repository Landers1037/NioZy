import type { IBufferLine, Terminal } from '@xterm/xterm'

/** xterm 缓冲区列号 → 字符串索引（CJK 等宽字符占多列但只占 1 个字符串位置） */
export function bufferColToStringIndex(line: IBufferLine, col: number): number {
  if (col <= 0) return 0
  return line.translateToString(false, 0, Math.min(col, line.length)).length
}

export function getTerminalBufferText(term: Terminal): string {
  const buffer = term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    if (line) lines.push(line.translateToString(true))
  }
  return lines.join('\n')
}

/** scrollback 区（viewport 之上的历史行） */
export function getTerminalScrollbackText(term: Terminal): string {
  const buffer = term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.baseY; i++) {
    const line = buffer.getLine(i)
    if (line) lines.push(line.translateToString(true))
  }
  return lines.join('\n')
}

/** 当前屏区（viewport + 活动行，不含 scrollback） */
export function getTerminalScreenText(term: Terminal): string {
  const buffer = term.buffer.active
  const lines: string[] = []
  for (let i = buffer.baseY; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    if (line) lines.push(line.translateToString(true))
  }
  return lines.join('\n')
}

/**
 * 将快照写回 xterm。须用 CRLF：仅 \\n 只会下移光标不会回到行首，会出现阶梯状错位。
 */
export function restoreTerminalBufferText(term: Terminal, bufferText: string): void {
  if (!bufferText) return
  const normalized = bufferText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.at(-1) === '' && normalized.endsWith('\n')) {
    lines.pop()
  }
  for (const line of lines) {
    term.writeln(line)
  }
}

/** 从 offload 分区（scrollback + screen）恢复缓冲区 */
export function restoreTerminalFromOffload(
  term: Terminal,
  scrollbackText: string,
  screenText: string,
): void {
  restoreTerminalBufferText(term, scrollbackText)
  if (!screenText) return
  const normalized = screenText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.at(-1) === '' && normalized.endsWith('\n')) {
    lines.pop()
  }
  for (const line of lines) {
    term.writeln(line)
  }
}
