import type {
  ResumeTermSession,
  SavedTerminalTab,
} from '../../electron/shared/resume-term-session'
import { RESUME_TERM_SESSION_VERSION } from '../../electron/shared/resume-term-session'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { toastTerminalError } from '@/lib/terminal-actions'
import {
  getSplitPanes,
  normalizeTabAfterSplitChange,
  resolveTabTerminalSpawn,
} from '@/lib/terminal-tab-utils'
import { isSshTerminalTab, getSshConnection } from '@/lib/ssh-connection'
import { isSshDynamicPasswordEnabled } from '../../electron/ssh-auth'
import { randomUUID } from '@/lib/id'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { resumeTermLog } from '@/lib/resume-term-log'

/** 启动恢复完成前禁止写入/清空 resume-term.json，避免空 Tab 状态误删已保存会话 */
let resumeTermBootComplete = false
/** 正在执行 restoreTerminalSessionFromDisk（含加载动画时段） */
let terminalSessionRestoreInProgress = false

export function setTerminalSessionRestoreInProgress(value: boolean): void {
  terminalSessionRestoreInProgress = value
}

export function isTerminalSessionRestoreInProgress(): boolean {
  return terminalSessionRestoreInProgress
}

export function markResumeTermBootComplete(): void {
  resumeTermLog.info('boot complete, enabling persist')
  resumeTermBootComplete = true
  void persistResumeTermSession()
}

export function isResumeTermBootComplete(): boolean {
  return resumeTermBootComplete
}

function isRemoteTerminalTab(tab: AppTab): boolean {
  if (tab.sshDeferredConnect) return true
  if (isSshTerminalTab(tab)) return true
  if (tab.shell === 'ssh') return true
  if (tab.terminalSpawn?.sshConnectionId) return true
  if (tab.terminalSpawn?.create.sshConnectionId) return true
  return false
}

export function buildResumeTermSession(): ResumeTermSession | null {
  const { tabs, activeTabId, terminalCwds, settings } = useAppStore.getState()
  const terminalTabs = tabs.filter((t) => t.type === 'terminal')
  if (terminalTabs.length === 0) return null

  const savedTabs: SavedTerminalTab[] = []
  for (const tab of terminalTabs) {
    const panes = getSplitPanes(tab)
    const spawn = resolveTabTerminalSpawn(tab, settings)
    if (!spawn) continue

    const splitPaneCount = tab.sshDeferredConnect
      ? Math.max(1, tab.deferredSplitPaneCount ?? 1)
      : panes.length
    if (!tab.sshDeferredConnect && panes.length === 0) continue

    const isLocal = !isRemoteTerminalTab(tab)
    savedTabs.push({
      title: tab.title,
      ...(tab.customTitle ? { customTitle: tab.customTitle } : {}),
      ...(tab.shell ? { shell: tab.shell } : {}),
      ...(tab.sshConnectionId ? { sshConnectionId: tab.sshConnectionId } : {}),
      terminalSpawn: spawn,
      ...(tab.activeSplitIndex !== undefined ? { activeSplitIndex: tab.activeSplitIndex } : {}),
      splitPaneCount,
      ...(isLocal
        ? {
            panes: panes.map((p) => {
              const cwd = terminalCwds[p.terminalId]
              return cwd ? { cwd } : {}
            }),
          }
        : {}),
    })
  }

  if (savedTabs.length === 0) return null

  const activeIdx = activeTabId ? terminalTabs.findIndex((t) => t.id === activeTabId) : -1
  const activeTerminalTabIndex = activeIdx >= 0 ? activeIdx : 0

  return {
    version: RESUME_TERM_SESSION_VERSION,
    activeTerminalTabIndex,
    tabs: savedTabs,
  }
}

export async function persistResumeTermSession(): Promise<void> {
  if (!resumeTermBootComplete) {
    resumeTermLog.debug('persist skipped: boot not complete')
    return
  }

  const { settings } = useAppStore.getState()
  if (!settings?.shell.restoreTerminalSessionOnRestart) {
    resumeTermLog.debug('persist skipped: setting disabled')
    return
  }

  const session = buildResumeTermSession()
  const api = getElectronAPI()
  if (session) {
    resumeTermLog.info('persist save', {
      tabCount: session.tabs.length,
      activeTerminalTabIndex: session.activeTerminalTabIndex,
    })
    await api.resumeTerm.save(session)
  } else {
    resumeTermLog.info('persist clear (no terminal tabs in store)')
    await api.resumeTerm.clear()
  }
}

function canRestoreSavedTab(
  saved: SavedTerminalTab,
  settings: ReturnType<typeof useAppStore.getState>['settings'],
): boolean {
  if (!saved.terminalSpawn) {
    resumeTermLog.warn('skip tab: missing terminalSpawn', { title: saved.title })
    return false
  }
  const connId =
    saved.sshConnectionId ??
    saved.terminalSpawn.sshConnectionId ??
    saved.terminalSpawn.create.sshConnectionId
  if (connId && !getSshConnection(settings, connId)) {
    resumeTermLog.warn('skip tab: ssh connection not found', { title: saved.title, connId })
    return false
  }
  return true
}

function resolveSavedTabSshConnectionId(saved: SavedTerminalTab): string | undefined {
  return (
    saved.sshConnectionId ??
    saved.terminalSpawn?.sshConnectionId ??
    saved.terminalSpawn?.create.sshConnectionId
  )
}

/** 会话恢复时：动态密码 SSH 仅恢复 Tab，不创建 PTY、不弹框 */
function shouldDeferSshDynamicConnect(
  saved: SavedTerminalTab,
  settings: ReturnType<typeof useAppStore.getState>['settings'],
): boolean {
  if (!settings || !saved.terminalSpawn) return false
  const connId = resolveSavedTabSshConnectionId(saved)
  const conn = getSshConnection(settings, connId)
  return !!conn && isSshDynamicPasswordEnabled(conn)
}

async function restoreSingleTerminalTab(
  saved: SavedTerminalTab,
  index: number,
): Promise<AppTab | null> {
  const { settings, setTerminalCwd } = useAppStore.getState()
  if (!settings || !saved.terminalSpawn) {
    resumeTermLog.warn('restore tab failed: no settings or spawn', { index, title: saved.title })
    return null
  }
  if (!canRestoreSavedTab(saved, settings)) return null

  const spawn = saved.terminalSpawn
  const paneCount = saved.splitPaneCount

  if (shouldDeferSshDynamicConnect(saved, settings)) {
    const connId =
      saved.sshConnectionId ??
      spawn.sshConnectionId ??
      spawn.create.sshConnectionId
    const tabId = `tab-deferred-${randomUUID()}`
    resumeTermLog.info('restore tab deferred (dynamic password)', {
      index,
      title: saved.title,
      paneCount,
      connId,
    })
    return {
      id: tabId,
      type: 'terminal',
      title: saved.title,
      ...(saved.customTitle ? { customTitle: saved.customTitle } : {}),
      shell: saved.shell ?? 'ssh',
      ...(connId ? { sshConnectionId: connId } : {}),
      terminalSpawn: spawn,
      sshDeferredConnect: true,
      deferredSplitPaneCount: paneCount,
      ...(saved.activeSplitIndex !== undefined && paneCount > 1
        ? { activeSplitIndex: saved.activeSplitIndex }
        : {}),
    }
  }

  const api = getElectronAPI()
  const newPanes: { terminalId: string }[] = []
  let lastShell = saved.shell
  let lastName = saved.title

  resumeTermLog.info('restore tab start', {
    index,
    title: saved.title,
    shell: saved.shell,
    paneCount,
    spawnShell: spawn.create.shell,
    cwds: saved.panes?.map((p) => p.cwd),
  })

  try {
    const paneSettled = await Promise.allSettled(
      Array.from({ length: paneCount }, async (_, i) => {
        const paneCwd = saved.panes?.[i]?.cwd
        const createPayload = {
          ...spawn.create,
          ...(paneCwd ? { cwd: paneCwd } : {}),
        }
        resumeTermLog.debug('create pane', { index, pane: i, shell: createPayload.shell, cwd: paneCwd })
        const result = await api.terminal.create(createPayload)
        resumeTermLog.debug('pane created', { index, pane: i, terminalId: result.id, cwd: result.cwd })
        return { result, paneCwd }
      }),
    )

    const fulfilled: { result: Awaited<ReturnType<typeof api.terminal.create>>; paneCwd?: string }[] = []
    let firstPaneError: unknown
    for (const entry of paneSettled) {
      if (entry.status === 'fulfilled') {
        fulfilled.push(entry.value)
      } else if (firstPaneError === undefined) {
        firstPaneError = entry.reason
      }
    }

    if (firstPaneError !== undefined) {
      for (const { result } of fulfilled) {
        try {
          api.terminal.kill(result.id)
        } catch {
          /* 忽略 */
        }
      }
      throw firstPaneError
    }

    for (const { result, paneCwd } of fulfilled) {
      lastShell = result.shell
      lastName = result.name
      setTerminalCwd(result.id, paneCwd ?? result.cwd)
      newPanes.push({ terminalId: result.id })
    }
  } catch (error) {
    resumeTermLog.error('restore tab failed: terminal.create error', {
      index,
      title: saved.title,
      error: error instanceof Error ? error.message : String(error),
      createdPanes: newPanes.length,
    })
    for (const pane of newPanes) {
      try {
        api.terminal.kill(pane.terminalId)
      } catch {
        /* 忽略 */
      }
    }
    toastTerminalError(error)
    return null
  }

  if (newPanes.length === 0) {
    resumeTermLog.warn('restore tab failed: no panes created', { index, title: saved.title })
    return null
  }

  const tabId = `tab-${newPanes[0]!.terminalId}`
  const activeIdx = saved.activeSplitIndex ?? 0
  const base: AppTab = {
    id: tabId,
    type: 'terminal',
    title: lastName,
    ...(saved.customTitle ? { customTitle: saved.customTitle } : {}),
    terminalId: newPanes[0]!.terminalId,
    shell: lastShell,
    ...(saved.sshConnectionId ?? spawn.sshConnectionId
      ? { sshConnectionId: saved.sshConnectionId ?? spawn.sshConnectionId }
      : {}),
    terminalSpawn: spawn,
  }

  const tab = normalizeTabAfterSplitChange(base, newPanes, activeIdx)
  resumeTermLog.info('restore tab ok', { index, tabId, terminalIds: newPanes.map((p) => p.terminalId) })
  return tab
}

export async function restoreTerminalSessionFromDisk(): Promise<boolean> {
  resumeTermLog.info('restore start')
  const { settings } = useAppStore.getState()
  if (!settings?.shell.restoreTerminalSessionOnRestart) {
    resumeTermLog.info('restore skipped: setting disabled', {
      hasSettings: !!settings,
      enabled: settings?.shell.restoreTerminalSessionOnRestart,
    })
    return false
  }

  const session = await getElectronAPI().resumeTerm.load()
  if (!session) {
    resumeTermLog.warn('restore failed: no session loaded from disk')
    return false
  }
  if (session.tabs.length === 0) {
    resumeTermLog.warn('restore failed: session has zero tabs')
    return false
  }

  resumeTermLog.info('restore session loaded', {
    tabCount: session.tabs.length,
    activeTerminalTabIndex: session.activeTerminalTabIndex,
    parallel: true,
  })

  const restoreResults = await Promise.all(
    session.tabs.map((saved, i) => restoreSingleTerminalTab(saved, i)),
  )
  const restored = restoreResults.filter((tab): tab is AppTab => tab !== null)

  if (restored.length === 0) {
    resumeTermLog.error('restore failed: all tabs failed to recreate', {
      savedTabCount: session.tabs.length,
    })
    return false
  }

  const activeIndex = Math.min(
    Math.max(0, session.activeTerminalTabIndex),
    restored.length - 1,
  )
  const activeTabId = restored[activeIndex]?.id ?? restored[0]!.id

  useAppStore.setState({
    tabs: restored,
    activeTabId,
  })

  for (const tab of restored) {
    touchTabActivity(tab.id)
  }

  resumeTermLog.info('restore ok', {
    restoredCount: restored.length,
    savedCount: session.tabs.length,
    activeTabId,
    activeIndex,
  })
  return true
}
