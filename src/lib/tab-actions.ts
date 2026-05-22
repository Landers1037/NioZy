import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { getTerminal } from '@/lib/terminal-registry'
import { getTerminalBufferText } from '@/lib/terminal-buffer'

function killTerminalIfNeeded(tab: { type: string; terminalId?: string }): void {
  if (tab.type === 'terminal' && tab.terminalId) {
    getElectronAPI().terminal.kill(tab.terminalId)
  }
}

export function closeTerminalTabs(tabIds: string[]): void {
  const { tabs, removeTabs } = useAppStore.getState()
  const toClose = tabs.filter((t) => tabIds.includes(t.id) && t.type === 'terminal')
  for (const tab of toClose) {
    killTerminalIfNeeded(tab)
  }
  removeTabs(tabIds)
}

export function closeOtherTerminalTabs(keepTabId: string): void {
  const { tabs } = useAppStore.getState()
  const ids = tabs.filter((t) => t.type === 'terminal' && t.id !== keepTabId).map((t) => t.id)
  closeTerminalTabs(ids)
}

export function formatExportFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-')
  return `NioZy-${stamp}.txt`
}

export async function exportTerminalTab(tabId: string): Promise<void> {
  const tab = useAppStore.getState().tabs.find((t) => t.id === tabId)
  if (!tab?.terminalId) {
    toast.error(i18n.t('toast.exportNoTerminal'))
    return
  }
  const term = getTerminal(tab.terminalId)
  if (!term) {
    toast.error(i18n.t('toast.exportNotReady'))
    return
  }
  const content = getTerminalBufferText(term)
  const saved = await getElectronAPI().files.saveText(content, formatExportFileName())
  if (saved) toast.success(i18n.t('toast.exportSuccess'))
}
