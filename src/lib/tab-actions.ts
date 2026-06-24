import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { getTerminal } from '@/lib/terminal-registry'
import { getTerminalBufferText } from '@/lib/terminal-buffer'
import { scheduleTerminalKills } from '@/lib/schedule-terminal-kills'
import { getActiveTerminalId, getAllTerminalIds } from '@/lib/terminal-tab-utils'
import type { AppTab } from '@/stores/app-store'

function collectTerminalIds(tabs: AppTab[]): { legacy: string[]; mux: string[] } {
  const legacy: string[] = []
  const mux: string[] = []
  for (const tab of tabs) {
    if (tab.type !== 'terminal') continue
    for (const terminalId of getAllTerminalIds(tab)) {
      if (tab.muxMode) mux.push(terminalId)
      else legacy.push(terminalId)
    }
  }
  return { legacy, mux }
}

export function closeTerminalTabs(tabIds: string[]): void {
  const { tabs, removeTabs } = useAppStore.getState()
  const idSet = new Set(tabIds)
  const toClose = tabs.filter((t) => idSet.has(t.id) && t.type === 'terminal')
  const { legacy, mux } = collectTerminalIds(toClose)

  removeTabs(tabIds)
  scheduleTerminalKills(legacy, mux)
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
  const terminalId = tab ? getActiveTerminalId(tab) : undefined
  if (!terminalId) {
    toast.error(i18n.t('toast.exportNoTerminal'))
    return
  }
  const term = getTerminal(terminalId)
  if (!term) {
    toast.error(i18n.t('toast.exportNotReady'))
    return
  }
  const content = getTerminalBufferText(term)
  const saved = await getElectronAPI().files.saveText(content, formatExportFileName())
  if (saved) toast.success(i18n.t('toast.exportSuccess'))
}
