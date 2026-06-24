import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { getElectronAPI } from '@/lib/electron-client'
import { useAppStore } from '@/stores/app-store'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { scheduleOverlayOpen } from '@/lib/context-menu-overlay'
import type { ScpFileEntry } from '../../electron/shared/api-types'

export function buildRemoteUploadTarget(
  localFileName: string,
  remotePath: string,
  selectedRemote: ScpFileEntry | null,
): string {
  if (selectedRemote?.isDirectory) {
    return `${selectedRemote.path.replace(/\/$/, '')}/${localFileName}`
  }
  if (remotePath.endsWith('/')) {
    return `${remotePath}${localFileName}`
  }
  return `${remotePath}/${localFileName}`
}

/** 通过 listLocal 能否成功判断路径是否为目录（文件路径会 listing 失败） */
export async function isLocalDirectory(path: string): Promise<boolean> {
  const result = await getElectronAPI().ssh.listLocal(path)
  return result.ok
}

export function openScpTransferForTab(tabId: string): void {
  scheduleOverlayOpen(() => openScpTransferForTabNow(tabId))
}

function openScpTransferForTabNow(tabId: string): void {
  const { settings, tabs, setScpTransferTabId } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || !isSshTerminalTab(tab)) return

  if (!settings?.ssh.scpTransferEnabled) {
    toast.message(i18n.t('toast.scpTransferDisabled'))
    return
  }

  setScpTransferTabId(tabId)
}
