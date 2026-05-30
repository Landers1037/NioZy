import { getTerminal } from '@/lib/terminal-registry'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { useAppStore } from '@/stores/app-store'

type FocusHandler = () => void

const wtermFocusHandlers = new Map<string, FocusHandler>()

export function registerWtermFocus(terminalId: string, focus: FocusHandler): void {
  wtermFocusHandlers.set(terminalId, focus)
}

export function unregisterWtermFocus(terminalId: string): void {
  wtermFocusHandlers.delete(terminalId)
}

export function focusTerminal(terminalId: string): boolean {
  const xterm = getTerminal(terminalId)
  if (xterm) {
    xterm.focus()
    return true
  }
  const wtermFocus = wtermFocusHandlers.get(terminalId)
  if (wtermFocus) {
    wtermFocus()
    return true
  }
  return false
}

export function getActiveTerminalIdForFocus(): string | undefined {
  const { tabs, activeTabId } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal')
  if (!tab) return undefined
  return getActiveTerminalId(tab)
}

export function focusActiveTerminal(): boolean {
  const terminalId = getActiveTerminalIdForFocus()
  if (!terminalId) return false
  return focusTerminal(terminalId)
}
