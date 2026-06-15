import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import type { AppTab } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { toastTerminalError, applySshDynamicPasswordToCreateOptions } from '@/lib/terminal-actions'
import {
  getSplitPanes,
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'

const reconnectingIds = new Set<string>()

function updateTab(
  tabId: string,
  updater: (tab: AppTab) => AppTab,
): void {
  useAppStore.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
  }))
}

export function formatTerminalExitMessage(code: number): string {
  const msg =
    code !== 0
      ? i18n.t('terminal.processExitedWithCode', { code })
      : i18n.t('terminal.processExited')
  return `\r\n\x1b[33m${msg}\x1b[0m\r\n`
}

export function markSshTerminalDisconnected(terminalId: string, tab: AppTab): void {
  if (!isSshTerminalTab(tab)) return
  useAppStore.getState().markSshTerminalDisconnected(terminalId)
}

export function isPlainEnterKey(event: KeyboardEvent): boolean {
  return (
    event.type === 'keydown' &&
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  )
}

/** SSH 已断开时按 Enter 在同一 Tab 内重连；返回 true 表示已拦截按键 */
export function tryHandleSshReconnectEnter(
  tab: AppTab,
  terminalId: string | undefined,
  event: KeyboardEvent,
): boolean {
  if (!terminalId || !isPlainEnterKey(event)) return false
  if (!isSshTerminalTab(tab)) return false
  if (!useAppStore.getState().sshDisconnectedTerminalIds[terminalId]) return false

  event.preventDefault()
  event.stopPropagation()
  void reconnectSshTerminalPane(tab.id, terminalId)
  return true
}

/** 在同一 Tab / 拆分 pane 内用原 SSH 配置重新 spawn */
export async function reconnectSshTerminalPane(
  tabId: string,
  oldTerminalId: string,
): Promise<void> {
  if (reconnectingIds.has(oldTerminalId)) return
  reconnectingIds.add(oldTerminalId)

  const { tabs, settings, setTerminalCwd, clearTerminalCwd, clearSshTerminalDisconnected } =
    useAppStore.getState()
  const tab = tabs.find((t) => t.id === tabId && t.type === 'terminal')
  if (!tab || !isSshTerminalTab(tab)) {
    reconnectingIds.delete(oldTerminalId)
    return
  }

  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn) {
    reconnectingIds.delete(oldTerminalId)
    return
  }

  const createWithDynamic = await applySshDynamicPasswordToCreateOptions(
    spawn.create,
    tab.sshConnectionId ?? spawn.sshConnectionId,
  )
  if (!createWithDynamic) {
    reconnectingIds.delete(oldTerminalId)
    return
  }

  const panes = getSplitPanes(tab)
  const paneIndex = panes.findIndex((p) => p.terminalId === oldTerminalId)
  if (paneIndex < 0) {
    reconnectingIds.delete(oldTerminalId)
    return
  }

  try {
    clearSshTerminalDisconnected(oldTerminalId)
    try {
      getElectronAPI().terminal.kill(oldTerminalId)
    } catch {
      /* 进程可能已退出 */
    }
    clearTerminalCwd(oldTerminalId)

    const result = await getElectronAPI().terminal.create(createWithDynamic)
    setTerminalCwd(result.id, result.cwd)

    const newPanes = panes.map((p, i) =>
      i === paneIndex ? { terminalId: result.id } : p,
    )
    const activeIdx = tab.activeSplitIndex ?? 0

    updateTab(tabId, (t) =>
      normalizeTabAfterSplitChange(
        {
          ...t,
          terminalId: paneIndex === 0 ? result.id : t.terminalId,
          shell: result.shell,
          sshConnectionId: t.sshConnectionId ?? spawn.sshConnectionId,
          terminalSpawn: t.terminalSpawn ?? spawn,
        },
        newPanes,
        activeIdx,
      ),
    )
  } catch (error) {
    useAppStore.getState().markSshTerminalDisconnected(oldTerminalId)
    toastTerminalError(error, i18n.t('terminal.sshReconnectFailed'))
  } finally {
    reconnectingIds.delete(oldTerminalId)
  }
}
