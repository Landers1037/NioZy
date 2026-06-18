/** DEC mode 2004 — 应用请求 bracketed paste 时，剪贴板粘贴需包 CSI 200~ / 201~ */
const BRACKETED_PASTE_MODE_RE = /\x1b\[\?2004([hl])/g
const MAX_ESC_TAIL = 16

const enabledByTerminal = new Map<string, boolean>()
const escapeTailByTerminal = new Map<string, string>()

export function trackTerminalOutputBracketedPaste(terminalId: string, chunk: string): void {
  const data = (escapeTailByTerminal.get(terminalId) ?? '') + chunk

  for (const match of data.matchAll(BRACKETED_PASTE_MODE_RE)) {
    enabledByTerminal.set(terminalId, match[1] === 'h')
  }

  const escIdx = data.lastIndexOf('\x1b')
  if (escIdx >= 0 && data.length - escIdx < MAX_ESC_TAIL) {
    escapeTailByTerminal.set(terminalId, data.slice(escIdx))
  } else {
    escapeTailByTerminal.delete(terminalId)
  }
}

export function isTerminalBracketedPasteEnabled(terminalId: string): boolean {
  return enabledByTerminal.get(terminalId) === true
}

export function clearTerminalBracketedPasteState(terminalId: string): void {
  enabledByTerminal.delete(terminalId)
  escapeTailByTerminal.delete(terminalId)
}
