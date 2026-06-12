import type { TerminalCreateOptions } from './api-types'

export const RESUME_TERM_SESSION_VERSION = 1

export interface SavedTerminalPane {
  /** 本地终端 pane 的工作目录 */
  cwd?: string
}

export interface SavedTerminalTab {
  title: string
  customTitle?: string
  shell?: string
  sshConnectionId?: string
  terminalSpawn?: {
    create: TerminalCreateOptions
    sshConnectionId?: string
  }
  activeSplitIndex?: number
  splitPaneCount: number
  panes?: SavedTerminalPane[]
}

export interface ResumeTermSession {
  version: typeof RESUME_TERM_SESSION_VERSION
  /** 上次活动终端 Tab 在 tabs 数组中的索引 */
  activeTerminalTabIndex: number
  tabs: SavedTerminalTab[]
}

export function normalizeResumeTermSession(value: unknown): ResumeTermSession | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResumeTermSession>
  if (v.version !== RESUME_TERM_SESSION_VERSION) return null
  if (!Array.isArray(v.tabs)) return null

  const tabs: SavedTerminalTab[] = []
  for (const raw of v.tabs) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Partial<SavedTerminalTab>
    if (typeof t.title !== 'string' || !t.title.trim()) continue
    const splitPaneCount =
      typeof t.splitPaneCount === 'number' && t.splitPaneCount >= 1
        ? Math.min(Math.floor(t.splitPaneCount), 3)
        : 1

    let terminalSpawn: SavedTerminalTab['terminalSpawn']
    if (t.terminalSpawn && typeof t.terminalSpawn === 'object') {
      const spawn = t.terminalSpawn as SavedTerminalTab['terminalSpawn']
      if (spawn?.create && typeof spawn.create === 'object' && typeof spawn.create.shell === 'string') {
        terminalSpawn = {
          create: spawn.create,
          ...(typeof spawn.sshConnectionId === 'string'
            ? { sshConnectionId: spawn.sshConnectionId }
            : {}),
        }
      }
    }

    let panes: SavedTerminalPane[] | undefined
    if (Array.isArray(t.panes)) {
      panes = t.panes.slice(0, splitPaneCount).map((p) => {
        if (!p || typeof p !== 'object') return {}
        const cwd = typeof (p as SavedTerminalPane).cwd === 'string' ? (p as SavedTerminalPane).cwd : undefined
        return cwd ? { cwd } : {}
      })
    }

    tabs.push({
      title: t.title.trim(),
      ...(typeof t.customTitle === 'string' && t.customTitle.trim()
        ? { customTitle: t.customTitle.trim() }
        : {}),
      ...(typeof t.shell === 'string' ? { shell: t.shell } : {}),
      ...(typeof t.sshConnectionId === 'string' ? { sshConnectionId: t.sshConnectionId } : {}),
      ...(terminalSpawn ? { terminalSpawn } : {}),
      ...(typeof t.activeSplitIndex === 'number' ? { activeSplitIndex: t.activeSplitIndex } : {}),
      splitPaneCount,
      ...(panes ? { panes } : {}),
    })
  }

  if (tabs.length === 0) return null

  const activeTerminalTabIndex =
    typeof v.activeTerminalTabIndex === 'number' && v.activeTerminalTabIndex >= 0
      ? Math.min(Math.floor(v.activeTerminalTabIndex), tabs.length - 1)
      : 0

  return {
    version: RESUME_TERM_SESSION_VERSION,
    activeTerminalTabIndex,
    tabs,
  }
}
