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

let pendingFocusTerminalId: string | null = null
let pendingFocusRaf = 0
let pendingFocusTimeout = 0

function clearPendingFocusRetry(): void {
  if (pendingFocusRaf) {
    cancelAnimationFrame(pendingFocusRaf)
    pendingFocusRaf = 0
  }
  if (pendingFocusTimeout) {
    window.clearTimeout(pendingFocusTimeout)
    pendingFocusTimeout = 0
  }
}

/** 新建终端后请求聚焦；终端尚未挂载时会重试直至就绪 */
export function requestTerminalFocus(terminalId: string): void {
  pendingFocusTerminalId = terminalId
  clearPendingFocusRetry()

  const attempt = (): void => {
    if (pendingFocusTerminalId !== terminalId) return
    if (focusTerminal(terminalId)) {
      pendingFocusTerminalId = null
      clearPendingFocusRetry()
      return
    }
    pendingFocusRaf = requestAnimationFrame(attempt)
  }

  attempt()
  pendingFocusTimeout = window.setTimeout(() => {
    if (pendingFocusTerminalId === terminalId) {
      focusTerminal(terminalId)
      pendingFocusTerminalId = null
    }
    clearPendingFocusRetry()
  }, 2000)
}

/** 终端视图挂载就绪时调用，完成待处理的聚焦请求 */
export function notifyTerminalFocusReady(terminalId: string): void {
  if (pendingFocusTerminalId === terminalId) {
    focusTerminal(terminalId)
    pendingFocusTerminalId = null
    clearPendingFocusRetry()
    return
  }
  if (getActiveTerminalIdForFocus() === terminalId) {
    focusTerminal(terminalId)
  }
}
