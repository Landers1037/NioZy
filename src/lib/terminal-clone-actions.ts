import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getActiveTerminalId,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { toastTerminalError } from '@/lib/terminal-actions'
import { requestTerminalFocus } from '@/lib/terminal-focus'
import { useTabGroupStore } from '@/stores/tab-group-store'

/** 基于现有终端 Tab 复制新 Tab，复用目录、环境变量与启动参数（含 SSH / 自定义连接） */
export async function cloneTerminalTab(tabId: string): Promise<void> {
  const { tabs, settings, terminalCwds, addTerminalTab, setTerminalCwd } =
    useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId && t.type === 'terminal')
  if (!tab) return

  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn) {
    toast.error(i18n.t('toast.cloneTerminalUnknown'))
    return
  }

  const sourceTerminalId = getActiveTerminalId(tab)
  const cwd =
    (sourceTerminalId ? terminalCwds[sourceTerminalId] : undefined) ??
    spawn.create.cwd

  try {
    const createOptions = {
      ...spawn.create,
      ...(cwd ? { cwd } : {}),
    }
    const result = await getElectronAPI().terminal.create(createOptions)
    setTerminalCwd(result.id, cwd ?? result.cwd)

    const newTabId = `tab-${result.id}`
    addTerminalTab({
      id: newTabId,
      type: 'terminal',
      title: result.name,
      terminalId: result.id,
      shell: result.shell,
      sshConnectionId: spawn.sshConnectionId ?? tab.sshConnectionId,
      terminalSpawn: {
        ...spawn,
        create: createOptions,
      },
    })
    useTabGroupStore.getState().addTabToActiveGroupIfAny(newTabId)
    requestTerminalFocus(result.id)
  } catch (error) {
    toastTerminalError(error, i18n.t('tab.cloneTerminal'))
  }
}
