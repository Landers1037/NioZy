import { create } from 'zustand'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { TabTerminalSpawn, TerminalSplitPane } from '@/lib/terminal-tab-utils'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { scheduleTabRemovalSideEffects } from '@/lib/schedule-tab-removal-side-effects'
import { scheduleTerminalKills } from '@/lib/schedule-terminal-kills'
import { getElectronAPI } from '@/lib/electron-client'
import { recordTerminalTabOpened } from '@/lib/usage-statistics'
import { applyLayoutFromSettings } from '@/lib/layout-mode'
import {
  applyAppLocale,
  getFilesystemTabTitle,
  getChatTabTitle,
  getSandboxTabTitle,
  getRepoTabTitle,
  getSessionTabTitle,
  getWorkspaceTabTitle,
  getSettingsTabTitle,
  getExcalidrawTabTitle,
  getDrawioTabTitle,
} from '@/lib/i18n'
import { uiStyleToDataAttribute } from '../../electron/shared/ui-style'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { randomUUID } from '@/lib/id'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useTabGroupStore } from '@/stores/tab-group-store'

export type TabType =
  | 'terminal'
  | 'settings'
  | 'filesystem'
  | 'webview'
  | 'sandbox'
  | 'chat'
  | 'vnc'
  | 'repo'
  | 'session'
  | 'workspace'
  | 'excalidraw'
  | 'drawio'

export interface AppTab {
  id: string
  type: TabType
  title: string
  /** 侧边栏与状态栏展示的自定义标题；为空则使用 title */
  customTitle?: string
  /** 链接预览 Tab 的 URL */
  webviewUrl?: string
  terminalId?: string
  shell?: string
  /** 由自定义 SSH 连接打开时关联的连接 id，用于 SCP 与断开告警 */
  sshConnectionId?: string
  /** 横向拆分的子终端（含主 pane），最多 3 个 */
  splitPanes?: TerminalSplitPane[]
  /** 拆分终端时复用的启动参数 */
  terminalSpawn?: TabTerminalSpawn
  /** 当前获得输入与输出流的拆分 pane 索引 */
  activeSplitIndex?: number
  /** SSH 动态密码：已恢复 Tab 元数据，切换到此 Tab 时再连接 */
  sshDeferredConnect?: true
  /** 待连接的分屏 pane 数量（sshDeferredConnect 时无 terminalId） */
  deferredSplitPaneCount?: number
  /** VNC Tab 关联的连接 id */
  vncConnectionId?: string
  /** 工作区目录（Start 后） */
  workspaceDir?: string
  /** 终端 Tab 创建时间（ISO 8601） */
  createdAt?: string
}

interface AppState {
  tabs: AppTab[]
  activeTabId: string | null
  sidebarCollapsed: boolean
  settings: AppSettings | null
  systemStats: {
    date: string
    time: string
    cpuPercent: number
    memoryPercent: number
    memoryUsedMb: number
    memoryTotalMb: number
    batteryPercent: number
    batteryCharging: boolean
    batteryHasBattery: boolean
  }
  windowMaximized: boolean
  /** 各终端 PTY 的当前工作目录（由主进程解析 OSC 序列更新） */
  terminalCwds: Record<string, string>
  /** 当前打开 SCP 传输面板的终端 Tab id */
  scpTransferTabId: string | null
  /** 已断开的 SSH 终端 PTY id（可按 Enter 在同一 Tab 内重连） */
  sshDisconnectedTerminalIds: Record<string, true>
  setScpTransferTabId: (tabId: string | null) => void
  markSshTerminalDisconnected: (terminalId: string) => void
  clearSshTerminalDisconnected: (terminalId: string) => void
  setSidebarCollapsed: (v: boolean) => void
  setActiveTab: (id: string) => void
  addTerminalTab: (tab: AppTab) => void
  addSettingsTab: () => void
  addFilesystemTab: () => void
  closeFilesystemTabIfPresent: () => void
  addExcalidrawTab: () => void
  closeExcalidrawTabIfPresent: () => void
  addDrawioTab: () => void
  closeDrawioTabIfPresent: () => void
  addRepoTab: () => void
  closeRepoTabIfPresent: () => void
  addSessionTab: () => void
  closeSessionTabIfPresent: () => void
  addWorkspaceTab: () => void
  closeWorkspaceTabIfPresent: () => void
  patchWorkspaceTab: (
    tabId: string,
    patch: {
      workspaceDir?: string
      terminalId?: string
      title?: string
    },
  ) => void
  addChatTab: () => void
  addSandboxTab: () => void
  closeSandboxTabIfPresent: () => void
  closeVncTabsIfPresent: () => void
  addVncTab: (connectionId: string) => void
  addWebviewTab: (url: string, title?: string) => void
  removeTab: (id: string) => void
  removeTabs: (ids: string[]) => void
  setTabCustomTitle: (id: string, customTitle: string | undefined) => void
  reorderTab: (tabId: string, toIndex: number) => void
  setTerminalCwd: (terminalId: string, cwd: string) => void
  clearTerminalCwd: (terminalId: string) => void
  setSettings: (s: AppSettings) => void
  patchSettings: (partial: Partial<AppSettings>) => Promise<void>
  setSystemStats: (stats: AppState['systemStats']) => void
  setWindowMaximized: (v: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
  settings: null,
  systemStats: {
    date: '----/--/--',
    time: '--:--:--',
    cpuPercent: 0,
    memoryPercent: 0,
    memoryUsedMb: 0,
    memoryTotalMb: 0,
    batteryPercent: 100,
    batteryCharging: false,
    batteryHasBattery: false,
  },
  windowMaximized: false,
  terminalCwds: {},
  scpTransferTabId: null,
  sshDisconnectedTerminalIds: {},
  setScpTransferTabId: (tabId) => set({ scpTransferTabId: tabId }),
  markSshTerminalDisconnected: (terminalId) =>
    set((s) => ({
      sshDisconnectedTerminalIds: {
        ...s.sshDisconnectedTerminalIds,
        [terminalId]: true,
      },
    })),
  clearSshTerminalDisconnected: (terminalId) =>
    set((s) => {
      if (!s.sshDisconnectedTerminalIds[terminalId]) return s
      const sshDisconnectedTerminalIds = { ...s.sshDisconnectedTerminalIds }
      delete sshDisconnectedTerminalIds[terminalId]
      return { sshDisconnectedTerminalIds }
    }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setActiveTab: (id) => set({ activeTabId: id }),
  addTerminalTab: (tab) => {
    useInactiveTabActivityStore.getState().touchTabActivity(tab.id)
    recordTerminalTabOpened(get().settings)
    const withCreatedAt = tab.createdAt ? tab : { ...tab, createdAt: new Date().toISOString() }
    set((s) => ({
      tabs: [...s.tabs, withCreatedAt],
      activeTabId: tab.id,
    }))
  },
  addSettingsTab: () => {
    const existing = get().tabs.find((t) => t.type === 'settings')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = { id: 'settings', type: 'settings', title: getSettingsTabTitle() }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  addFilesystemTab: () => {
    const existing = get().tabs.find((t) => t.type === 'filesystem')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'filesystem',
      type: 'filesystem',
      title: getFilesystemTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeFilesystemTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'filesystem')
    if (!existing) return
    get().removeTab(existing.id)
  },
  addExcalidrawTab: () => {
    const existing = get().tabs.find((t) => t.type === 'excalidraw')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'excalidraw',
      type: 'excalidraw',
      title: getExcalidrawTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeExcalidrawTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'excalidraw')
    if (!existing) return
    get().removeTab(existing.id)
  },
  addDrawioTab: () => {
    const existing = get().tabs.find((t) => t.type === 'drawio')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'drawio',
      type: 'drawio',
      title: getDrawioTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeDrawioTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'drawio')
    if (!existing) return
    get().removeTab(existing.id)
  },
  addRepoTab: () => {
    const existing = get().tabs.find((t) => t.type === 'repo')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'repo',
      type: 'repo',
      title: getRepoTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeRepoTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'repo')
    if (!existing) return
    get().removeTab(existing.id)
  },
  addSessionTab: () => {
    const existing = get().tabs.find((t) => t.type === 'session')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'session',
      type: 'session',
      title: getSessionTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeSessionTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'session')
    if (!existing) return
    get().removeTab(existing.id)
  },
  addWorkspaceTab: () => {
    const tabId = `workspace-${randomUUID()}`
    useWorkspaceStore.getState().ensureSession(tabId)
    const tab: AppTab = {
      id: tabId,
      type: 'workspace',
      title: getWorkspaceTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
    useTabGroupStore.getState().addTabToActiveGroupIfAny(tabId)
  },
  closeWorkspaceTabIfPresent: () => {
    const workspaceTabs = get().tabs.filter((t) => t.type === 'workspace')
    if (workspaceTabs.length === 0) return
    get().removeTabs(workspaceTabs.map((t) => t.id))
  },
  patchWorkspaceTab: (tabId, patch) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId || t.type !== 'workspace') return t
        const next: AppTab = { ...t }
        if (patch.workspaceDir !== undefined) {
          if (patch.workspaceDir) next.workspaceDir = patch.workspaceDir
          else delete next.workspaceDir
        }
        if (patch.terminalId !== undefined) {
          if (patch.terminalId) next.terminalId = patch.terminalId
          else delete next.terminalId
        }
        if (patch.title !== undefined) {
          next.title = patch.title || getWorkspaceTabTitle()
        }
        return next
      }),
    }))
  },
  addChatTab: () => {
    const existing = get().tabs.find((t) => t.type === 'chat')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'chat',
      type: 'chat',
      title: getChatTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  addSandboxTab: () => {
    const existing = get().tabs.find((t) => t.type === 'sandbox')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = {
      id: 'sandbox',
      type: 'sandbox',
      title: getSandboxTabTitle(),
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  closeSandboxTabIfPresent: () => {
    const existing = get().tabs.find((t) => t.type === 'sandbox')
    if (!existing) return
    get().removeTab(existing.id)
  },
  closeVncTabsIfPresent: () => {
    const vncTabs = get().tabs.filter((t) => t.type === 'vnc')
    if (vncTabs.length === 0) return
    get().removeTabs(vncTabs.map((t) => t.id))
  },
  addVncTab: (connectionId) => {
    const settings = get().settings
    const conn = settings?.connections.find((c) => c.id === connectionId)
    const title = conn?.name?.trim() || 'VNC'
    const id = `vnc-${connectionId}`
    const existing = get().tabs.find((t) => t.id === id)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab: AppTab = { id, type: 'vnc', title, vncConnectionId: connectionId }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  addWebviewTab: (url, title) => {
    const id = `webview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tab: AppTab = {
      id,
      type: 'webview',
      title: title ?? url,
      webviewUrl: url,
    }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  removeTab: (id) => {
    get().removeTabs([id])
  },
  removeTabs: (ids) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const snapshot = get()
    const removed = snapshot.tabs.filter((t) => idSet.has(t.id))
    const removedTerminalCount = removed.filter((t) => t.type === 'terminal').length
    const removedTabIds = removed.map((t) => t.id)
    const workspaceTerminalIds = removed
      .filter((t) => t.type === 'workspace' && t.terminalId)
      .map((t) => t.terminalId!)
    if (workspaceTerminalIds.length > 0) {
      scheduleTerminalKills(workspaceTerminalIds)
    }

    set((s) => {
      const tabs = s.tabs.filter((t) => !idSet.has(t.id))
      let activeTabId = s.activeTabId
      if (s.activeTabId && idSet.has(s.activeTabId)) {
        const firstTerminal = tabs.find((t) => t.type === 'terminal')
        activeTabId = firstTerminal?.id ?? tabs[0]?.id ?? null
      }
      const terminalCwds = { ...s.terminalCwds }
      const sshDisconnectedTerminalIds = { ...s.sshDisconnectedTerminalIds }
      for (const tab of removed) {
        if (tab.type === 'workspace' && tab.terminalId) {
          delete terminalCwds[tab.terminalId]
        }
        for (const terminalId of getAllTerminalIds(tab)) {
          delete terminalCwds[terminalId]
          delete sshDisconnectedTerminalIds[terminalId]
        }
      }
      return { tabs, activeTabId, terminalCwds, sshDisconnectedTerminalIds }
    })

    scheduleTabRemovalSideEffects(removedTabIds, removedTerminalCount, snapshot.settings)
  },
  setTerminalCwd: (terminalId, cwd) =>
    set((s) => ({
      terminalCwds: { ...s.terminalCwds, [terminalId]: cwd },
    })),
  clearTerminalCwd: (terminalId) =>
    set((s) => {
      const terminalCwds = { ...s.terminalCwds }
      delete terminalCwds[terminalId]
      return { terminalCwds }
    }),
  setTabCustomTitle: (id, customTitle) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t
        const trimmed = customTitle?.trim()
        if (!trimmed) {
          const { customTitle: _removed, ...rest } = t
          return rest
        }
        return { ...t, customTitle: trimmed }
      }),
    })),
  reorderTab: (tabId, toIndex) =>
    set((s) => {
      const fromIndex = s.tabs.findIndex((t) => t.id === tabId)
      if (fromIndex < 0 || fromIndex === toIndex) return s
      const tabs = [...s.tabs]
      const [item] = tabs.splice(fromIndex, 1)
      const clamped = Math.max(0, Math.min(toIndex, tabs.length))
      tabs.splice(clamped, 0, item)
      return { tabs }
    }),
  setSettings: (settings) => {
    applyAppLocale(settings.locale)
    set({
      settings,
      tabs: get().tabs.map((t) => {
        if (t.type === 'settings') return { ...t, title: getSettingsTabTitle() }
        if (t.type === 'filesystem') return { ...t, title: getFilesystemTabTitle() }
        if (t.type === 'repo') return { ...t, title: getRepoTabTitle() }
        if (t.type === 'session') return { ...t, title: getSessionTabTitle() }
        if (t.type === 'workspace' && !t.workspaceDir) {
          return { ...t, title: getWorkspaceTabTitle() }
        }
        if (t.type === 'chat') return { ...t, title: getChatTabTitle() }
        if (t.type === 'sandbox') return { ...t, title: getSandboxTabTitle() }
        if (t.type === 'excalidraw') return { ...t, title: getExcalidrawTabTitle() }
        if (t.type === 'drawio') return { ...t, title: getDrawioTabTitle() }
        return t
      }),
    })
    applyThemeToDocument(settings)
    applyLayoutFromSettings(settings, get().setSidebarCollapsed)
  },
  patchSettings: async (partial) => {
    const updated = await getElectronAPI().settings.save(partial)
    applyAppLocale(updated.locale)
    set({
      settings: updated,
      tabs: get().tabs.map((t) => {
        if (t.type === 'settings') return { ...t, title: getSettingsTabTitle() }
        if (t.type === 'filesystem') return { ...t, title: getFilesystemTabTitle() }
        if (t.type === 'repo') return { ...t, title: getRepoTabTitle() }
        if (t.type === 'session') return { ...t, title: getSessionTabTitle() }
        if (t.type === 'workspace' && !t.workspaceDir) {
          return { ...t, title: getWorkspaceTabTitle() }
        }
        if (t.type === 'chat') return { ...t, title: getChatTabTitle() }
        if (t.type === 'sandbox') return { ...t, title: getSandboxTabTitle() }
        if (t.type === 'excalidraw') return { ...t, title: getExcalidrawTabTitle() }
        if (t.type === 'drawio') return { ...t, title: getDrawioTabTitle() }
        return t
      }),
    })
    applyThemeToDocument(updated)
    applyLayoutFromSettings(updated, get().setSidebarCollapsed)
  },
  setSystemStats: (systemStats) => set({ systemStats }),
  setWindowMaximized: (windowMaximized) => set({ windowMaximized }),
}))

export function applyThemeToDocument(settings: AppSettings): void {
  const root = document.documentElement
  root.classList.toggle('dark', settings.theme === 'dark')
  root.dataset.uiStyle = uiStyleToDataAttribute(settings.uiStyle)
  if (settings.uiStyle === 'glass' && settings.enableGlassTransparency) {
    root.dataset.glassVibrancy = 'true'
  } else {
    delete root.dataset.glassVibrancy
  }
  root.style.setProperty('--primary', settings.accentColor)
  root.style.setProperty('--ring', settings.accentColor)
  root.style.setProperty('--app-font-size', `${settings.fontSize}px`)
  root.style.fontSize = `${settings.fontSize}px`

  if (typeof settings.fontWeight === 'number') {
    root.style.setProperty('--app-font-weight', `${settings.fontWeight}`)
  } else {
    root.style.removeProperty('--app-font-weight')
  }
  if (typeof settings.fontWeightBold === 'number') {
    root.style.setProperty('--app-font-weight-bold', `${settings.fontWeightBold}`)
  } else {
    root.style.removeProperty('--app-font-weight-bold')
  }
}

export type { CustomConnection }
