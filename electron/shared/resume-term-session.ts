import type { TerminalCreateOptions } from './api-types'

export const RESUME_TERM_SESSION_VERSION = 3
export const LEGACY_RESUME_TERM_SESSION_VERSION = 1
export const LEGACY_RESUME_TERM_SESSION_VERSION_V2 = 2

export interface SavedTerminalSplitLayout {
  xRatio?: number
  yRatio?: number
  bottomXRatio?: number
}

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
  splitLayout?: SavedTerminalSplitLayout
  panes?: SavedTerminalPane[]
}

export type SavedMarkdownEditorMode = 'wysiwyg' | 'source'

export interface SavedMarkdownTab {
  title: string
  customTitle?: string
  markdownFilePath: string
  mode?: SavedMarkdownEditorMode
  themeId?: string
  /** 未保存到磁盘的编辑内容 */
  dirtyContent?: string
}

export type SavedSessionTab =
  | ({ kind: 'terminal' } & SavedTerminalTab)
  | ({ kind: 'markdown' } & SavedMarkdownTab)

export interface ResumeTermSession {
  version: typeof RESUME_TERM_SESSION_VERSION
  /** 上次活动可恢复 Tab 在 tabs 数组中的索引 */
  activeTabIndex: number
  tabs: SavedSessionTab[]
}

function normalizeSavedTerminalTab(raw: unknown): SavedTerminalTab | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<SavedTerminalTab>
  if (typeof t.title !== 'string' || !t.title.trim()) return null
  const splitPaneCount =
    typeof t.splitPaneCount === 'number' && t.splitPaneCount >= 1
      ? Math.min(Math.floor(t.splitPaneCount), 4)
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

  let splitLayout: SavedTerminalSplitLayout | undefined
  if (t.splitLayout && typeof t.splitLayout === 'object') {
    const rawLayout = t.splitLayout as SavedTerminalSplitLayout
    splitLayout = {
      ...(typeof rawLayout.xRatio === 'number' ? { xRatio: rawLayout.xRatio } : {}),
      ...(typeof rawLayout.yRatio === 'number' ? { yRatio: rawLayout.yRatio } : {}),
      ...(typeof rawLayout.bottomXRatio === 'number'
        ? { bottomXRatio: rawLayout.bottomXRatio }
        : {}),
    }
  }

  return {
    title: t.title.trim(),
    ...(typeof t.customTitle === 'string' && t.customTitle.trim()
      ? { customTitle: t.customTitle.trim() }
      : {}),
    ...(typeof t.shell === 'string' ? { shell: t.shell } : {}),
    ...(typeof t.sshConnectionId === 'string' ? { sshConnectionId: t.sshConnectionId } : {}),
    ...(terminalSpawn ? { terminalSpawn } : {}),
    ...(typeof t.activeSplitIndex === 'number' ? { activeSplitIndex: t.activeSplitIndex } : {}),
    splitPaneCount,
    ...(splitLayout ? { splitLayout } : {}),
    ...(panes ? { panes } : {}),
  }
}

function normalizeSavedMarkdownTab(raw: unknown): SavedMarkdownTab | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<SavedMarkdownTab>
  if (typeof t.title !== 'string' || !t.title.trim()) return null
  if (typeof t.markdownFilePath !== 'string' || !t.markdownFilePath.trim()) return null

  const mode =
    t.mode === 'wysiwyg' || t.mode === 'source' ? t.mode : undefined
  const themeId = typeof t.themeId === 'string' && t.themeId.trim() ? t.themeId.trim() : undefined
  const dirtyContent =
    typeof t.dirtyContent === 'string' ? t.dirtyContent : undefined

  return {
    title: t.title.trim(),
    markdownFilePath: t.markdownFilePath.trim(),
    ...(typeof t.customTitle === 'string' && t.customTitle.trim()
      ? { customTitle: t.customTitle.trim() }
      : {}),
    ...(mode ? { mode } : {}),
    ...(themeId ? { themeId } : {}),
    ...(dirtyContent !== undefined ? { dirtyContent } : {}),
  }
}

function normalizeSavedSessionTab(raw: unknown): SavedSessionTab | null {
  if (!raw || typeof raw !== 'object') return null
  const kind = (raw as { kind?: unknown }).kind
  if (kind === 'markdown') {
    const markdown = normalizeSavedMarkdownTab(raw)
    return markdown ? { kind: 'markdown', ...markdown } : null
  }
  if (kind === 'terminal' || kind === undefined) {
    const terminal = normalizeSavedTerminalTab(raw)
    return terminal ? { kind: 'terminal', ...terminal } : null
  }
  return null
}

function normalizeLegacyResumeTermSession(value: unknown): ResumeTermSession | null {
  if (!value || typeof value !== 'object') return null
  const v = value as {
    version?: unknown
    activeTerminalTabIndex?: unknown
    tabs?: unknown
  }
  if (v.version !== LEGACY_RESUME_TERM_SESSION_VERSION) return null
  if (!Array.isArray(v.tabs)) return null

  const tabs: SavedSessionTab[] = []
  for (const raw of v.tabs) {
    const terminal = normalizeSavedTerminalTab(raw)
    if (terminal) tabs.push({ kind: 'terminal', ...terminal })
  }
  if (tabs.length === 0) return null

  const activeTabIndex =
    typeof v.activeTerminalTabIndex === 'number' && v.activeTerminalTabIndex >= 0
      ? Math.min(Math.floor(v.activeTerminalTabIndex), tabs.length - 1)
      : 0

  return {
    version: RESUME_TERM_SESSION_VERSION,
    activeTabIndex,
    tabs,
  }
}

function normalizeV2ResumeTermSession(value: unknown): ResumeTermSession | null {
  if (!value || typeof value !== 'object') return null
  const v = value as {
    version?: unknown
    activeTabIndex?: unknown
    tabs?: unknown
  }
  if (v.version !== LEGACY_RESUME_TERM_SESSION_VERSION_V2) return null
  if (!Array.isArray(v.tabs)) return null

  const tabs: SavedSessionTab[] = []
  for (const raw of v.tabs) {
    const tab = normalizeSavedSessionTab(raw)
    if (tab) tabs.push(tab)
  }
  if (tabs.length === 0) return null

  const activeTabIndex =
    typeof v.activeTabIndex === 'number' && v.activeTabIndex >= 0
      ? Math.min(Math.floor(v.activeTabIndex), tabs.length - 1)
      : 0

  return {
    version: RESUME_TERM_SESSION_VERSION,
    activeTabIndex,
    tabs,
  }
}

export function normalizeResumeTermSession(value: unknown): ResumeTermSession | null {
  if (!value || typeof value !== 'object') return null
  const v = value as {
    version?: unknown
    activeTabIndex?: unknown
    activeTerminalTabIndex?: unknown
    tabs?: unknown
  }

  if (v.version === LEGACY_RESUME_TERM_SESSION_VERSION) {
    return normalizeLegacyResumeTermSession(value)
  }
  if (v.version === LEGACY_RESUME_TERM_SESSION_VERSION_V2) {
    return normalizeV2ResumeTermSession(value)
  }
  if (v.version !== RESUME_TERM_SESSION_VERSION) return null
  if (!Array.isArray(v.tabs)) return null

  const tabs: SavedSessionTab[] = []
  for (const raw of v.tabs) {
    const tab = normalizeSavedSessionTab(raw)
    if (tab) tabs.push(tab)
  }
  if (tabs.length === 0) return null

  const activeTabIndex =
    typeof v.activeTabIndex === 'number' && v.activeTabIndex >= 0
      ? Math.min(Math.floor(v.activeTabIndex), tabs.length - 1)
      : 0

  return {
    version: RESUME_TERM_SESSION_VERSION,
    activeTabIndex,
    tabs,
  }
}
