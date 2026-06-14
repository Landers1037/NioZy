import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { getElectronAPI } from '@/lib/electron-client'
import { useAppStore } from '@/stores/app-store'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'
import { getTerminal } from '@/lib/terminal-registry'
import { getTerminalBufferText } from '@/lib/terminal-buffer'
import { readTerminalSelectionText } from '@/lib/terminal-selection'
import { writeTerminalInput } from '@/lib/terminal-write'
import { formatExportFileName } from '@/lib/tab-actions'
import { prepareCommandForReplay } from '@/lib/command-replay'
import { focusTerminal } from '@/lib/terminal-focus'
import { useTerminalUiStore } from '@/stores/terminal-ui-store'

export const TERMINAL_FONT_SIZE_MIN = 10
export const TERMINAL_FONT_SIZE_MAX = 24

/** 菜单关闭后 Radix 会把焦点还给 trigger，需延迟将焦点还回终端 */
function refocusContextMenuTerminal(terminalId: string): void {
  window.requestAnimationFrame(() => {
    focusTerminal(terminalId)
  })
}

export async function copyTerminalSelectionFromContextMenu(): Promise<void> {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  const term = getTerminal(menu.terminalId)
  const text = readTerminalSelectionText(term)
  if (!text) {
    toast.message(i18n.t('toast.selectTerminalFirst'))
    return
  }
  await navigator.clipboard.writeText(text)
}

export async function pasteToTerminalFromContextMenu(): Promise<void> {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  const { terminalId } = menu
  const text = await navigator.clipboard.readText()
  if (text) writeTerminalInput(terminalId, text)
  refocusContextMenuTerminal(terminalId)
}

export async function copyAndPasteToTerminalFromContextMenu(): Promise<void> {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  const term = getTerminal(menu.terminalId)
  const text = readTerminalSelectionText(term)
  if (!text) {
    toast.message(i18n.t('toast.selectTerminalFirst'))
    return
  }
  await navigator.clipboard.writeText(text)
  writeTerminalInput(menu.terminalId, text)
  refocusContextMenuTerminal(menu.terminalId)
}

export function openTerminalSearchFromContextMenu(): void {
  useTerminalUiStore.getState().requestTerminalSearch()
}

export async function exportTerminalFromContextMenu(): Promise<void> {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  const term = getTerminal(menu.terminalId)
  if (!term) {
    toast.error(i18n.t('toast.exportNotReady'))
    return
  }
  const content = getTerminalBufferText(term)
  const saved = await getElectronAPI().files.saveText(content, formatExportFileName())
  if (saved) toast.success(i18n.t('toast.exportSuccess'))
}

export function replayCommandFromContextMenu(command: string): void {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  getElectronAPI().terminal.write(menu.terminalId, prepareCommandForReplay(command))
  refocusContextMenuTerminal(menu.terminalId)
}

export function adjustTerminalFontSizeFromContextMenu(delta: number): void {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings) return
  const current = settings.terminal.fontSize
  const next = Math.min(
    TERMINAL_FONT_SIZE_MAX,
    Math.max(TERMINAL_FONT_SIZE_MIN, current + delta),
  )
  if (next === current) return
  void patchSettings({ terminal: { ...settings.terminal, fontSize: next } })
}

export function addTerminalSelectionToAiSidebarFromContextMenu(): void {
  const menu = useTerminalUiStore.getState().contextMenu
  if (!menu) return
  const term = getTerminal(menu.terminalId)
  const text = readTerminalSelectionText(term)
  if (!text.trim()) {
    toast.message(i18n.t('toast.selectTerminalFirst'))
    return
  }
  useAiSidebarStore.getState().queueInputAppend(text)
}
