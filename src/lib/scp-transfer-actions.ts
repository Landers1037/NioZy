import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { isSshTerminalTab } from '@/lib/ssh-connection'

export function openScpTransferForTab(tabId: string): void {
  const { settings, tabs, setScpTransferTabId } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || !isSshTerminalTab(tab)) return

  if (!settings?.ssh.scpTransferEnabled) {
    toast.message(i18n.t('toast.scpTransferDisabled'))
    return
  }

  setScpTransferTabId(tabId)
}
