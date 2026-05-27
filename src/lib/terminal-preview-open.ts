import type { PreviewSettings } from '../../electron/shared/preview-settings'
import type { TerminalPreviewFileKind } from '../../electron/shared/terminal-preview-files'
import { getElectronAPI } from '@/lib/electron-client'
import { useTerminalPreviewStore } from '@/stores/terminal-preview-store'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { isValidHttpUrl, openTerminalExternalLink } from '@/lib/terminal-url'
import { basenameFromPath } from '@/lib/path-utils'

export function openTerminalLinkPreview(url: string): void {
  if (!isValidHttpUrl(url)) return
  try {
    const parsed = new URL(url)
    const title =
      parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname.slice(0, 24) : '')
    useAppStore.getState().addWebviewTab(url, title || i18n.t('settings.preview.linkTabTitle'))
  } catch {
    openTerminalExternalLink(url)
  }
}

export async function openTerminalFilePreview(
  filePath: string,
  kind: TerminalPreviewFileKind,
  options: { isSsh: boolean },
): Promise<void> {
  if (options.isSsh) {
    toast.error(i18n.t('settings.preview.sshNotSupported'))
    return
  }
  if (kind === 'none') return

  const result = await getElectronAPI().files.getTerminalFilePreviewUrl(filePath, kind)
  if (!result.ok || !result.url) {
    toast.error(result.error ?? i18n.t('settings.preview.previewFailed'))
    return
  }

  useTerminalPreviewStore.getState().openFilePreview({
    filePath,
    fileName: basenameFromPath(filePath),
    kind,
  })
}

export function handleTerminalLinkClick(
  url: string,
  event: MouseEvent,
  preview: PreviewSettings,
  clickToOpenLinks: boolean,
): boolean {
  if (event.ctrlKey && preview.linkPreview) {
    event.preventDefault()
    event.stopPropagation()
    openTerminalLinkPreview(url)
    return true
  }
  if (clickToOpenLinks && !event.ctrlKey) {
    event.preventDefault()
    event.stopPropagation()
    openTerminalExternalLink(url)
    return true
  }
  return false
}
