import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getBuiltinTerminalOptions,
  getDefaultBuiltinShell,
} from '@/lib/builtin-connection-options'
import type { BuiltinShellType } from '../../electron/shared/builtin-shells'
import { requestTerminalFocus } from '@/lib/terminal-focus'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { toastTerminalError } from '@/lib/terminal-actions'
import { getMuxPaneCount } from '@/lib/mux-terminal-render'

export async function createMuxTerminal(shell?: BuiltinShellType): Promise<void> {
  const settings = useAppStore.getState().settings
  const resolved = shell ?? getDefaultBuiltinShell(settings)
  const paneCount = getMuxPaneCount(settings)
  const spawn = getBuiltinTerminalOptions(resolved, settings)

  try {
    const result = await getElectronAPI().muxTerminal.create({
      shell: spawn.shell,
      args: spawn.args,
      env: spawn.env,
      paneCount,
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
    })
    useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
    requestTerminalFocus(result.id)
  } catch (error) {
    toastTerminalError(error, i18n.t('toast.muxTerminalStartFailed'))
  }
}
