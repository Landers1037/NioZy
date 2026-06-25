import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getBuiltinTerminalOptions,
  getDefaultBuiltinShell,
} from '@/lib/builtin-connection-options'
import type { BuiltinShellType } from '../../electron/shared/builtin-shells'
import type { MuxLayoutKind, MuxPaneCount } from '../../electron/shared/mux-terminal-types'
import {
  layoutKindFromPaneCount,
  normalizeMuxLayoutKind,
  normalizeMuxPaneCount,
  paneCountFromLayoutKind,
} from '../../electron/shared/mux-terminal-types'
import { requestTerminalFocus } from '@/lib/terminal-focus'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { toastTerminalError } from '@/lib/terminal-actions'

export async function createMuxTerminal(
  shell?: BuiltinShellType,
  layoutKind?: MuxLayoutKind | MuxPaneCount,
): Promise<void> {
  const settings = useAppStore.getState().settings
  const resolved = shell ?? getDefaultBuiltinShell(settings)
  const spawn = getBuiltinTerminalOptions(resolved, settings)
  const normalizedLayout =
    typeof layoutKind === 'number'
      ? layoutKindFromPaneCount(normalizeMuxPaneCount(layoutKind))
      : normalizeMuxLayoutKind(layoutKind ?? settings?.experimental.muxPaneCount)

  try {
    const result = await getElectronAPI().muxTerminal.create({
      shell: spawn.shell,
      args: spawn.args,
      env: spawn.env,
      layoutKind: normalizedLayout,
      paneCount: paneCountFromLayoutKind(normalizedLayout),
    })
    const { addTerminalTab, setTerminalCwd } = useAppStore.getState()
    setTerminalCwd(result.id, result.cwd)
    const tabId = `tab-mux-${result.id}`
    addTerminalTab({
      id: tabId,
      type: 'terminal',
      title: `${result.name} (Mux)`,
      terminalId: result.id,
      shell: result.shell,
      muxMode: true,
      muxPaneCount: result.paneCount,
      muxLayoutKind: result.layoutKind,
    })
    useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
    requestTerminalFocus(result.id)
  } catch (error) {
    toastTerminalError(error, i18n.t('toast.muxTerminalStartFailed'))
  }
}
