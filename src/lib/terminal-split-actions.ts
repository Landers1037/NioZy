import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getSplitPanes,
  MAX_TERMINAL_SPLITS,
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
  type TerminalSplitPane,
} from '@/lib/terminal-tab-utils'
import { toastTerminalError } from '@/lib/terminal-actions'

function updateTab(tabId: string, updater: (tab: import('@/stores/app-store').AppTab) => import('@/stores/app-store').AppTab): void {
  useAppStore.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
  }))
}

export async function splitTerminalTab(tabId: string): Promise<void> {
  const { tabs, settings, setTerminalCwd } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId && t.type === 'terminal')
  if (!tab) return

  const panes = getSplitPanes(tab)
  if (panes.length >= MAX_TERMINAL_SPLITS) {
    toast.error(i18n.t('toast.splitTerminalMax'))
    return
  }

  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn) {
    toast.error(i18n.t('toast.splitTerminalUnknown'))
    return
  }

  try {
    const { sshConnectionId, create: createOptions } = spawn
    const result = await getElectronAPI().terminal.create(createOptions)
    setTerminalCwd(result.id, result.cwd)

    const newPanes: TerminalSplitPane[] = [...panes, { terminalId: result.id }]
    const activeSplitIndex = newPanes.length - 1

    updateTab(tabId, (t) =>
      normalizeTabAfterSplitChange(
        {
          ...t,
          terminalSpawn: t.terminalSpawn ?? spawn,
          sshConnectionId: t.sshConnectionId ?? sshConnectionId,
        },
        newPanes,
        activeSplitIndex,
      ),
    )
  } catch (error) {
    toastTerminalError(error)
  }
}

export function closeSplitPane(tabId: string, terminalId: string): void {
  const { tabs, clearTerminalCwd } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId && t.type === 'terminal')
  if (!tab) return

  const panes = getSplitPanes(tab)
  if (panes.length <= 1) return

  const removeIndex = panes.findIndex((p) => p.terminalId === terminalId)
  if (removeIndex < 0) return

  getElectronAPI().terminal.kill(terminalId)
  clearTerminalCwd(terminalId)

  const newPanes = panes.filter((p) => p.terminalId !== terminalId)
  let activeSplitIndex = tab.activeSplitIndex ?? 0
  if (activeSplitIndex >= newPanes.length) {
    activeSplitIndex = newPanes.length - 1
  } else if (removeIndex < activeSplitIndex) {
    activeSplitIndex -= 1
  }

  updateTab(tabId, (t) => normalizeTabAfterSplitChange(t, newPanes, activeSplitIndex))
}

export function setActiveSplitPane(tabId: string, index: number): void {
  updateTab(tabId, (t) => {
    const panes = getSplitPanes(t)
    if (panes.length <= 1) return t
    const idx = Math.min(Math.max(0, index), panes.length - 1)
    return { ...t, activeSplitIndex: idx }
  })
}
