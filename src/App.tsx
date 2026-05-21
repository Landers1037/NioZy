import { useEffect, useRef } from 'react'
import { Toaster } from 'sonner'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { TerminalView } from '@/components/terminal/TerminalView'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { useAppStore, applyThemeToDocument } from '@/stores/app-store'
import { createTerminal } from '@/lib/terminal-actions'
import { getElectronAPI, isElectron } from '@/lib/electron-client'

export default function App() {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setSettings = useAppStore((s) => s.setSettings)
  const setSystemStats = useAppStore((s) => s.setSystemStats)
  const setWindowMaximized = useAppStore((s) => s.setWindowMaximized)
  const statusBarLiveStats = useAppStore(
    (s) => s.settings?.advanced.statusBarLiveStats !== false,
  )

  const booted = useRef(false)

  useEffect(() => {
    let cancelled = false
    let unsubMax: (() => void) | undefined

    const setup = (): boolean => {
      if (cancelled || !isElectron()) return false
      const api = getElectronAPI()
      api.settings.get().then((s) => {
        if (!cancelled) {
          setSettings(s)
          applyThemeToDocument(s)
        }
      })
      api.window.isMaximized().then((v) => {
        if (!cancelled) setWindowMaximized(v)
      })
      unsubMax = api.window.onMaximized(setWindowMaximized)

      if (!booted.current) {
        booted.current = true
        createTerminal('powershell').catch(console.error)
      }
      return true
    }

    if (setup()) {
      return () => {
        cancelled = true
        unsubMax?.()
      }
    }

    const timer = window.setInterval(() => {
      if (setup()) window.clearInterval(timer)
    }, 50)
    const timeout = window.setTimeout(() => window.clearInterval(timer), 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      unsubMax?.()
    }
  }, [setSettings, setSystemStats, setWindowMaximized])

  useEffect(() => {
    if (!isElectron()) return
    const api = getElectronAPI()
    let cancelled = false
    let unsubStats: (() => void) | undefined

    if (statusBarLiveStats) {
      api.system.getStats().then((stats) => {
        if (!cancelled) setSystemStats(stats)
      })
      unsubStats = api.system.onStats(setSystemStats)
    }

    return () => {
      cancelled = true
      unsubStats?.()
    }
  }, [statusBarLiveStats, setSystemStats])

  if (!isElectron()) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <p className="text-lg font-semibold text-foreground">未检测到 Electron 环境</p>
        <p className="max-w-md text-sm text-muted-foreground">
          请使用 <code className="rounded bg-muted px-1.5 py-0.5">npm run start</code>{' '}
          启动桌面应用。不要在浏览器中直接打开 Vite 开发地址。
        </p>
      </div>
    )
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex h-full flex-col bg-background">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-background p-2">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {tabs
              .filter((t) => t.type === 'terminal')
              .map((tab) => (
                <div key={tab.id} className="absolute inset-0 p-1">
                  <TerminalView tab={tab} visible={activeTabId === tab.id} />
                </div>
              ))}
            {activeTab?.type === 'settings' && (
              <div className="absolute inset-0">
                <SettingsPanel />
              </div>
            )}
            {tabs.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                点击「新建终端」开始
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
