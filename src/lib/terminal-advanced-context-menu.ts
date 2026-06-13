import type { Terminal } from '@xterm/xterm'
import { normalizeAdvancedRightClickMenu, normalizeRightClickCopyPaste } from '../../electron/shared/terminal-xterm'
import type { AppSettings } from '../../electron/shared/api-types'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import { useTerminalUiStore } from '@/stores/terminal-ui-store'

type TerminalRightClickSettings = Pick<
  AppSettings['terminal'],
  'rightClickCopyPaste' | 'advancedRightClickMenu'
>

export function isTerminalRightClickCopyPasteEnabled(
  terminal: TerminalRightClickSettings | undefined,
): boolean {
  if (!terminal) return false
  const copyPaste = normalizeRightClickCopyPaste(terminal.rightClickCopyPaste)
  const advanced = normalizeAdvancedRightClickMenu(terminal.advancedRightClickMenu)
  return copyPaste && !advanced
}

export function isTerminalAdvancedRightClickMenuEnabled(
  terminal: TerminalRightClickSettings | undefined,
): boolean {
  if (!terminal) return false
  const copyPaste = normalizeRightClickCopyPaste(terminal.rightClickCopyPaste)
  const advanced = normalizeAdvancedRightClickMenu(terminal.advancedRightClickMenu)
  return advanced && !copyPaste
}

export function openTerminalAdvancedContextMenu(
  event: MouseEvent,
  terminalId: string,
  tabId: string,
  term?: Terminal | null,
): void {
  event.preventDefault()
  event.stopPropagation()

  const selection = readTerminalSelectionText(term)
  useTerminalUiStore.getState().openContextMenu({
    x: event.clientX,
    y: event.clientY,
    terminalId,
    tabId,
    hasSelection: selection.length > 0,
  })
}
