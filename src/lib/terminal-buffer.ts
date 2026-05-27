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
