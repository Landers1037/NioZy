import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { getElectronAPI } from '@/lib/electron-client'
import { writeTerminalInput } from '@/lib/terminal-write'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { requestTerminalFocus } from '@/lib/terminal-focus'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { useAppStore, type AppTab } from '@/stores/app-store'
import type { ShellType } from '../../electron/shared/api-types'

type ElectronFile = File & { path?: string }

export function hasExternalFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types).includes('Files')
}

export function getDroppedFilePaths(dataTransfer: DataTransfer): string[] {
  const api = getElectronAPI()
  const paths: string[] = []
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i]
    const path = api.files.getPathForFile?.(file) ?? (file as ElectronFile).path
    if (path) paths.push(path)
  }
  return paths
}

function escapePsSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

function escapeCmdDoubleQuoted(value: string): string {
  return value.replace(/"/g, '""')
}

export function formatCdCommand(shell: ShellType | string | undefined, directory: string): string {
  switch (shell) {
    case 'cmd':
      return `cd /d "${escapeCmdDoubleQuoted(directory)}"\r`
    case 'powershell':
    case 'pwsh':
      return `Set-Location -LiteralPath '${escapePsSingleQuoted(directory)}'\r`
    default:
      return `cd '${directory.replace(/'/g, "'\\''")}'\r`
  }
}

export async function changeTerminalTabDirectory(tab: AppTab, droppedPath: string): Promise<void> {
  if (isSshTerminalTab(tab)) {
    toast.error(i18n.t('tab.dropDirectoryUnsupported'))
    return
  }

  const terminalId = getActiveTerminalId(tab)
  if (!terminalId) return

  const result = await getElectronAPI().files.resolveTerminalDropDirectory(droppedPath)
  if (!result.ok || !result.directory) {
    toast.error(result.error ?? i18n.t('tab.dropDirectoryFailed'))
    return
  }

  useAppStore.getState().setActiveTab(tab.id)
  writeTerminalInput(terminalId, formatCdCommand(tab.shell, result.directory))
  requestTerminalFocus(terminalId)
}
