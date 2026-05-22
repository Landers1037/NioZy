import { create } from 'zustand'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { TabTerminalSpawn, TerminalSplitPane } from '@/lib/terminal-tab-utils'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { getElectronAPI } from '@/lib/electron-client'
import { applyLayoutFromSettings } from '@/lib/layout-mode'
import { applyAppLocale, getFilesystemTabTitle, getSettingsTabTitle } from '@/lib/i18n'
import { uiStyleToDataAttribute } from '../../electron/shared/ui-style'

export type TabType = 'terminal' | 'settings' | 'filesystem'

export interface AppTab {
  id: string
  type: TabType
  title: string
  /** 侧边栏与状态栏展示的自定义标题；为空则使用 title */
  customTitle?: string
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
  setScpTransferTabId: (tabId: string | null) => void
  setSidebarCollapsed: (v: boolean) => void
  setActiveTab: (id: string) => void
  addTerminalTab: (tab: AppTab) => void
  addSettingsTab: () => void
  addFilesystemTab: () => void
  removeTab: (id: string) => void
  removeTabs: (ids: string[]) => void
  setTabCustomTitle: (id: string, customTitle: string | undefined) => void
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
  setScpTransferTabId: (tabId) => set({ scpTransferTabId: tabId }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setActiveTab: (id) => set({ activeTabId: id }),
  addTerminalTab: (tab) =>
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    })),
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
  removeTab: (id) => {
    get().removeTabs([id])
  },
  removeTabs: (ids) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    set((s) => {
      const removed = s.tabs.filter((t) => idSet.has(t.id))
      const tabs = s.tabs.filter((t) => !idSet.has(t.id))
      let activeTabId = s.activeTabId
      if (s.activeTabId && idSet.has(s.activeTabId)) {
        const firstTerminal = tabs.find((t) => t.type === 'terminal')
        activeTabId = firstTerminal?.id ?? tabs[0]?.id ?? null
      }
      const terminalCwds = { ...s.terminalCwds }
      for (const tab of removed) {
        for (const terminalId of getAllTerminalIds(tab)) {
          delete terminalCwds[terminalId]
        }
      }
      return { tabs, activeTabId, terminalCwds }
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
