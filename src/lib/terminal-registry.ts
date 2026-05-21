import type { Terminal } from '@xterm/xterm'

const terminals = new Map<string, Terminal>()

export function registerTerminal(terminalId: string, term: Terminal): void {
  terminals.set(terminalId, term)
}

export function unregisterTerminal(terminalId: string): void {
  terminals.delete(terminalId)
}

export function getTerminal(terminalId: string): Terminal | undefined {
  return terminals.get(terminalId)
}
