import { create } from 'zustand'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import { getElectronAPI } from '@/lib/electron-client'
import { applyLayoutFromSettings } from '@/lib/layout-mode'
import { applyAppLocale, getSettingsTabTitle } from '@/lib/i18n'

export type TabType = 'terminal' | 'settings'

export interface AppTab {
  id: string
  type: TabType
  title: string
  /** 侧边栏与状态栏展示的自定义标题；为空则使用 title */
  customTitle?: string
  terminalId?: string
  shell?: string
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
  setSidebarCollapsed: (v: boolean) => void
  setActiveTab: (id: string) => void
  addTerminalTab: (tab: AppTab) => void
  addSettingsTab: () => void
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
        if (tab.terminalId) delete terminalCwds[tab.terminalId]
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
      tabs: get().tabs.map((t) =>
        t.type === 'settings' ? { ...t, title: getSettingsTabTitle() } : t,
      ),
    })
    applyThemeToDocument(settings)
    applyLayoutFromSettings(settings, get().setSidebarCollapsed)
  },
  patchSettings: async (partial) => {
    const updated = await getElectronAPI().settings.save(partial)
    applyAppLocale(updated.locale)
    set({
      settings: updated,
      tabs: get().tabs.map((t) =>
        t.type === 'settings' ? { ...t, title: getSettingsTabTitle() } : t,
      ),
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
  root.style.setProperty('--primary', settings.accentColor)
  root.style.setProperty('--ring', settings.accentColor)
  root.style.setProperty('--app-font-size', `${settings.fontSize}px`)
  root.style.fontSize = `${settings.fontSize}px`
}

export type { CustomConnection }
