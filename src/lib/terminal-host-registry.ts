const terminalHosts = new Map<string, HTMLElement>()

export function registerTerminalHost(terminalId: string, host: HTMLElement): void {
  terminalHosts.set(terminalId, host)
}

export function unregisterTerminalHost(terminalId: string): void {
  terminalHosts.delete(terminalId)
}

export function getTerminalHost(terminalId: string): HTMLElement | undefined {
  return terminalHosts.get(terminalId)
}
