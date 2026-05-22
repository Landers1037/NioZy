import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { tabHasTerminalId } from '@/lib/terminal-tab-utils'

/** 后台 SSH 终端断开时在右下角通知（需开启设置） */
export function useSshDisconnectAlert(): void {
  const { t } = useTranslation()

  useEffect(() => {
    const api = getElectronAPI()
    const unsub = api.terminal.onExit((terminalId) => {
      const { settings, tabs, activeTabId } = useAppStore.getState()
      if (!settings?.ssh.alertOnDisconnect) return

      const tab = tabs.find(
        (item) =>
          item.type === 'terminal' &&
          tabHasTerminalId(item, terminalId) &&
          item.shell === 'ssh' &&
          item.sshConnectionId,
      )
      if (!tab || tab.id === activeTabId) return

      toast.warning(t('toast.sshDisconnected', { title: getTabDisplayTitle(tab) }))
    })
    return unsub
  }, [t])
}
