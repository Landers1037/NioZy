import { create } from 'zustand'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { TabTerminalSpawn, TerminalSplitPane } from '@/lib/terminal-tab-utils'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { getElectronAPI } from '@/lib/electron-client'
import { applyLayoutFromSettings } from '@/lib/layout-mode'
import { applyAppLocale, getFilesystemTabTitle, getSettingsTabTitle } from '@/lib/i18n'
import { uiStyleToDataAttribute } from '../../electron/shared/ui-style'

export type TabType = 'terminal' | 'settings' | 'filesystem' | 'webview'

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
    set((s) => ({
      tabs: [...s.tabs, tab],
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
    set((s) => {
      const removed = s.tabs.filter((t) => idSet.has(t.id))
      for (const tab of removed) {
        if (tab.type === 'webview') {
          void getElectronAPI().preview.close(tab.id)
        }
      }
      const tabs = s.tabs.filter((t) => !idSet.has(t.id))
      let activeTabId = s.activeTabId
      if (s.activeTabId && idSet.has(s.activeTabId)) {
        const firstTerminal = tabs.find((t) => t.type === 'terminal')
        activeTabId = firstTerminal?.id ?? tabs[0]?.id ?? null
      }
      const terminalCwds = { ...s.terminalCwds }
      const sshDisconnectedTerminalIds = { ...s.sshDisconnectedTerminalIds }
      for (const tab of removed) {
        useInactiveTabActivityStore.getState().clearTabActivity(tab.id)
        for (const terminalId of getAllTerminalIds(tab)) {
          delete terminalCwds[terminalId]
          delete sshDisconnectedTerminalIds[terminalId]
        }
      }
      const removedTabIds = removed.map((t) => t.id)
      if (removedTabIds.length > 0) {
        const attachStore = useAttachPtySessionStore.getState()
        attachStore.clearSnapshots(removedTabIds)
        if (attachStore.committed && removedTabIds.includes(attachStore.committed.tabId)) {
          attachStore.setCommitted(null)
          attachStore.setPendingTabId(null)
        }
      }
      return { tabs, activeTabId, terminalCwds, sshDisconnectedTerminalIds }
    })
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
  root.style.setProperty('--primary', settings.accentColor)
  root.style.setProperty('--ring', settings.accentColor)
  root.style.setProperty('--app-font-size', `${settings.fontSize}px`)
  root.style.fontSize = `${settings.fontSize}px`
}

export type { CustomConnection }
