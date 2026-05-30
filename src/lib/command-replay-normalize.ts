/** CSI 最终字节 */
const CSI_FINAL = /[@-~]/

/**
 * 将录制的原始 PTY 输入整理为可编辑/重放的命令文本。
 * - 保留可打印字符、换行、退格效果
 * - 展开 bracketed paste
 * - 丢弃光标移动等控制序列（如 \\x1b[C）
 */
export function normalizeRecordedCommandInput(raw: string): string {
  if (!raw) return ''

  const lines: string[] = ['']
  let line = 0
  let col = 0

  const currentLine = (): string => lines[line] ?? ''
  const setCurrentLine = (value: string): void => {
    lines[line] = value
  }

  const insertText = (text: string): void => {
    for (const ch of text) {
      if (ch === '\r' || ch === '\n') {
        insertNewline()
        continue
      }
      const row = currentLine()
      setCurrentLine(row.slice(0, col) + ch + row.slice(col))
      col++
    }
  }

  const insertNewline = (): void => {
    const row = currentLine()
    const tail = row.slice(col)
    setCurrentLine(row.slice(0, col))
    lines.splice(line + 1, 0, tail)
    line++
    col = 0
  }

  const backspace = (): void => {
    if (col > 0) {
      const row = currentLine()
      setCurrentLine(row.slice(0, col - 1) + row.slice(col))
      col--
      return
    }
    if (line <= 0) return
    const prev = lines[line - 1] ?? ''
    line--
    col = prev.length
    setCurrentLine(prev + currentLine())
    lines.splice(line + 1, 1)
  }

  let i = 0
  while (i < raw.length) {
    const bracketedStart = raw.indexOf('\x1b[200~', i)
    if (bracketedStart === i) {
      const bracketedEnd = raw.indexOf('\x1b[201~', i + 6)
      if (bracketedEnd !== -1) {
        insertText(raw.slice(i + 6, bracketedEnd))
        i = bracketedEnd + 6
        continue
      }
    }

    const ch = raw[i]!

    if (ch === '\x1b') {
      if (raw[i + 1] === '[') {
        let j = i + 2
        while (j < raw.length && !CSI_FINAL.test(raw[j]!)) j++
        if (j < raw.length) {
          i = j + 1
          continue
        }
      }
      if (raw[i + 1] === 'O' && i + 2 < raw.length) {
        i += 3
        continue
      }
      if (i + 1 < raw.length && raw[i + 1]! >= ' ' && raw[i + 1]! <= '~') {
        i += 2
        continue
      }
      i++
      continue
    }

    if (ch === '\r' || ch === '\n') {
      insertNewline()
      i++
      continue
    }

    if (ch === '\x7f' || ch === '\b') {
      backspace()
      i++
      continue
    }

    if (ch === '\t') {
      insertText('  ')
      i++
      continue
    }

    if (ch < ' ' || ch === '\x7f') {
      i++
      continue
    }

    insertText(ch)
    i++
  }

  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines.join('\n')
}
