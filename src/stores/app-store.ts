import { create } from 'zustand'
import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import { getElectronAPI } from '@/lib/electron-client'

export type TabType = 'terminal' | 'settings'

export interface AppTab {
  id: string
  type: TabType
  title: string
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
  setSidebarCollapsed: (v: boolean) => void
  setActiveTab: (id: string) => void
  addTerminalTab: (tab: AppTab) => void
  addSettingsTab: () => void
  removeTab: (id: string) => void
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
    const tab: AppTab = { id: 'settings', type: 'settings', title: '设置' }
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }))
  },
  removeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      let activeTabId = s.activeTabId
      if (s.activeTabId === id) {
        const firstTerminal = tabs.find((t) => t.type === 'terminal')
        activeTabId = firstTerminal?.id ?? tabs[0]?.id ?? null
      }
      return { tabs, activeTabId }
    }),
  setSettings: (settings) => set({ settings }),
  patchSettings: async (partial) => {
    const updated = await getElectronAPI().settings.save(partial)
    set({ settings: updated })
    applyThemeToDocument(updated)
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
