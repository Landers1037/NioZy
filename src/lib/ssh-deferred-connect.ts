import { useSyncExternalStore } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import {
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { applySshDynamicPasswordToCreateOptions, toastTerminalError } from '@/lib/terminal-actions'
import { cancelSshDynamicPassword } from '@/lib/ssh-dynamic-password-prompt'
import { isTerminalSessionRestoreInProgress, isResumeTermBootComplete } from '@/lib/resume-term-session'
import { resumeTermLog } from '@/lib/resume-term-log'

const activatingTabIds = new Set<string>()
const listeners = new Set<() => void>()

function notifyActivatingListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeActivating(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isSshDeferredConnectActivating(tabId: string): boolean {
  return activatingTabIds.has(tabId)
}

export function useIsSshDeferredConnecting(tabId: string): boolean {
  return useSyncExternalStore(subscribeActivating, () => activatingTabIds.has(tabId))
}

export function cancelSshDeferredConnectActivation(): void {
  cancelSshDynamicPassword()
}

function updateTab(tabId: string, updater: (tab: AppTab) => AppTab): void {
  useAppStore.setState((s) => ({
    tabs: s.tabs.map((t) => (t.id === tabId ? updater(t) : t)),
  }))
}

/** 启动恢复结束后，若活动 Tab 为待连接 SSH 则触发连接 */
export function connectDeferredSshForActiveTabIfNeeded(): void {
  if (!isResumeTermBootComplete() || isTerminalSessionRestoreInProgress()) return
  const { activeTabId, tabs } = useAppStore.getState()
  if (!activeTabId) return
  const tab = tabs.find((t) => t.id === activeTabId)
  if (tab?.sshDeferredConnect) {
    void activateDeferredSshTab(tab)
  }
}

/** 切换到待连接 Tab 时：弹动态密码并创建 PTY */
export async function activateDeferredSshTab(tab: AppTab): Promise<boolean> {
  if (!tab.sshDeferredConnect || activatingTabIds.has(tab.id)) return false

  const { settings, setTerminalCwd } = useAppStore.getState()
  const spawn = resolveTabTerminalSpawn(tab, settings)
  if (!spawn) return false

  const paneCount = Math.max(1, tab.deferredSplitPaneCount ?? 1)
  activatingTabIds.add(tab.id)
  notifyActivatingListeners()

  resumeTermLog.info('deferred ssh connect start', { tabId: tab.id, title: tab.title, paneCount })

  try {
    const connId =
      tab.sshConnectionId ?? spawn.sshConnectionId ?? spawn.create.sshConnectionId
    const createWithDynamic = await applySshDynamicPasswordToCreateOptions(
      spawn.create,
      connId,
    )
    if (!createWithDynamic) {
      resumeTermLog.info('deferred ssh connect cancelled', { tabId: tab.id })
      return false
    }

    const api = getElectronAPI()
    const paneSettled = await Promise.allSettled(
      Array.from({ length: paneCount }, async () => {
        const result = await api.terminal.create(createWithDynamic)
        return result
      }),
    )

    const fulfilled: Awaited<ReturnType<typeof api.terminal.create>>[] = []
    let firstPaneError: unknown
    for (const entry of paneSettled) {
      if (entry.status === 'fulfilled') {
        fulfilled.push(entry.value)
      } else if (firstPaneError === undefined) {
        firstPaneError = entry.reason
      }
    }

    if (firstPaneError !== undefined) {
      for (const result of fulfilled) {
        try {
          api.terminal.kill(result.id)
        } catch {
          /* 忽略 */
        }
      }
      throw firstPaneError
    }

    const newPanes = fulfilled.map((result) => {
      setTerminalCwd(result.id, result.cwd)
      return { terminalId: result.id }
    })
    const lastResult = fulfilled[fulfilled.length - 1]!
    const activeIdx = tab.activeSplitIndex ?? 0

    updateTab(tab.id, (t) =>
      normalizeTabAfterSplitChange(
        {
          ...t,
          terminalId: newPanes[0]?.terminalId,
          title: lastResult.name,
          shell: lastResult.shell,
          sshConnectionId: t.sshConnectionId ?? spawn.sshConnectionId,
          terminalSpawn: t.terminalSpawn ?? spawn,
          sshDeferredConnect: undefined,
          deferredSplitPaneCount: undefined,
        },
        newPanes,
        activeIdx,
      ),
    )

    resumeTermLog.info('deferred ssh connect ok', {
      tabId: tab.id,
      terminalIds: newPanes.map((p) => p.terminalId),
    })
    return true
  } catch (error) {
    resumeTermLog.error('deferred ssh connect failed', {
      tabId: tab.id,
      error: error instanceof Error ? error.message : String(error),
    })
    toastTerminalError(error, tab.title)
    return false
  } finally {
    activatingTabIds.delete(tab.id)
    notifyActivatingListeners()
  }
}
