import { isTerminalBracketedPasteEnabled } from '@/lib/terminal-bracketed-paste'
import { writeTerminalInput } from '@/lib/terminal-write'

const BRACKETED_PASTE_START = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'

/** Windows 剪贴板 CRLF → LF，避免 vi 等将 \\r 与 \\n 各算一次换行 */
export function normalizeClipboardTextForPty(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** 按 DEC 2004 状态包装 bracketed paste，与 Tabby / Windows Terminal 行为对齐 */
export function formatClipboardPasteForPty(terminalId: string, text: string): string {
  const normalized = normalizeClipboardTextForPty(text)
  if (!normalized) return normalized
  if (!isTerminalBracketedPasteEnabled(terminalId)) return normalized
  return `${BRACKETED_PASTE_START}${normalized}${BRACKETED_PASTE_END}`
}

/** 剪贴板 / 多行选区写入 PTY（规范化换行 + 可选 bracketed paste） */
export function pasteTerminalClipboard(terminalId: string, text: string): void {
  const payload = formatClipboardPasteForPty(terminalId, text)
  if (payload) writeTerminalInput(terminalId, payload)
}
