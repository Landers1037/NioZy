import { getElectronAPI } from '@/lib/electron-client'

/** 与 @xterm/addon-web-links 内置规则一致 */
export const TERMINAL_URL_REGEX =
  /(https?):[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/gi

export const TERMINAL_LINK_FOREGROUND = '#58a6ff'

export function openTerminalExternalLink(uri: string): void {
  void getElectronAPI().shell.openExternal(uri)
}

export function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function findUrlAtColumn(lineText: string, col: number): string | null {
  TERMINAL_URL_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TERMINAL_URL_REGEX.exec(lineText)) !== null) {
    const url = match[0]
    const start = match.index
    const end = start + url.length
    if (col >= start && col < end && isValidHttpUrl(url)) return url
  }
  return null
}

export function lineTextHasUrl(lineText: string): boolean {
  TERMINAL_URL_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TERMINAL_URL_REGEX.exec(lineText)) !== null) {
    if (isValidHttpUrl(match[0])) return true
  }
  return false
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
