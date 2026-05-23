import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { getElectronAPI } from '@/lib/electron-client'
import type { FilesystemSettings } from '../../electron/shared/filesystem-settings'

async function resolveProgramPath(
  kind: 'vscode' | 'cursor' | 'custom',
  configuredPath: string,
): Promise<string | null> {
  const api = getElectronAPI()
  const result = await api.files.detectProgram({
    kind,
    path: configuredPath.trim() || undefined,
  })
  return result.found && result.path ? result.path : null
}

export async function openPathWithEditor(
  filesystem: FilesystemSettings,
  kind: 'vscode' | 'cursor',
  targetPath: string,
): Promise<void> {
  const configured =
    kind === 'vscode' ? filesystem.vsCodePath : filesystem.cursorPath
  const programPath = await resolveProgramPath(kind, configured)
  if (!programPath) {
    toast.error(
      kind === 'vscode'
        ? i18n.t('filesystem.openVsCodeFailed')
        : i18n.t('filesystem.openCursorFailed'),
    )
    return
  }
  const result = await getElectronAPI().files.openWithProgram(programPath, targetPath)
  if (!result.ok) {
    toast.error(result.error ?? i18n.t('filesystem.openProgramFailed'))
  }
}

export async function openPathWithCustom(
  programPath: string,
  targetPath: string,
): Promise<void> {
  const resolved = await resolveProgramPath('custom', programPath)
  if (!resolved) {
    toast.error(i18n.t('filesystem.openCustomFailed', { path: programPath }))
    return
  }
  const result = await getElectronAPI().files.openWithProgram(resolved, targetPath)
  if (!result.ok) {
    toast.error(result.error ?? i18n.t('filesystem.openProgramFailed'))
  }
}
