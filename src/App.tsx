import { useEffect, useRef, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MinimalTabBar } from '@/components/layout/MinimalTabBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { isMinimalLayout } from '@/lib/layout-mode'
import { useTerminalStreamSync } from '@/hooks/useTerminalStreamSync'
import { useSuperPowerSavingPtySync } from '@/hooks/useSuperPowerSavingPtySync'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { TerminalTabLayer } from '@/components/terminal/TerminalTabLayer'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { useAppStore, applyThemeToDocument } from '@/stores/app-store'
import { useUiClasses } from '@/lib/ui-style'
import { createTerminal, openTerminalInDirectory } from '@/lib/terminal-actions'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { getElectronAPI, isBrowserDevPreview, isElectron } from '@/lib/electron-client'
import { useAppShortcuts } from '@/hooks/useAppShortcuts'
import { useSshDisconnectAlert } from '@/hooks/useSshDisconnectAlert'
import { cn } from '@/lib/utils'

const SettingsPanel = lazy(() =>
  import('@/components/settings/SettingsPanel').then((m) => ({
    default: m.SettingsPanel,
  })),
)
const FilesystemPanel = lazy(() =>
  import('@/components/filesystem/FilesystemPanel').then((m) => ({
    default: m.FilesystemPanel,
  })),
)
const ScpTransferDialog = lazy(() =>
  import('@/components/scp/ScpTransferDialog').then((m) => ({
    default: m.ScpTransferDialog,
  })),
)

export default function App() {
  const { t } = useTranslation()
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setSettings = useAppStore((s) => s.setSettings)
  const setSystemStats = useAppStore((s) => s.setSystemStats)
  const setWindowMaximized = useAppStore((s) => s.setWindowMaximized)
  const setTerminalCwd = useAppStore((s) => s.setTerminalCwd)
  const clearTerminalCwd = useAppStore((s) => s.clearTerminalCwd)
  const settings = useAppStore((s) => s.settings)
  const ui = useUiClasses()
  const statusBarLiveStats = settings?.advanced.statusBarLiveStats !== false
  const minimalLayout = isMinimalLayout(settings)

  const booted = useRef(false)

  useAppShortcuts()
  useSshDisconnectAlert()
  useTerminalStreamSync(tabs, activeTabId)
  useSuperPowerSavingPtySync(tabs, activeTabId)

  useEffect(() => {
    if (activeTabId) touchTabActivity(activeTabId)
  }, [activeTabId])

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
        void (async () => {
          const pending = await api.app.getPendingOpenDirectory()
          if (pending) await openTerminalInDirectory(pending)
          else await createTerminal()
        })()
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

  useEffect(() => {
    if (!isElectron()) return
    const api = getElectronAPI()
    const unsubCwd = api.terminal.onCwd(setTerminalCwd)
    const unsubExit = api.terminal.onExit((id) => clearTerminalCwd(id))
    const unsubOpenDir = api.app.onOpenDirectory((directory) => {
      void openTerminalInDirectory(directory)
    })
    const unsubNewTerminal = api.app.onNewTerminal(() => {
      void createTerminal()
    })
    const unsubOpenSettings = api.app.onOpenSettings(() => {
      useAppStore.getState().addSettingsTab()
    })
    return () => {
      unsubCwd()
      unsubExit()
      unsubOpenDir()
      unsubNewTerminal()
      unsubOpenSettings()
    }
  }, [setTerminalCwd, clearTerminalCwd])

  if (!isElectron()) {
    return null
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const scpTransferTabId = useAppStore((s) => s.scpTransferTabId)
  const setScpTransferTabId = useAppStore((s) => s.setScpTransferTabId)
  const scpTransferTab = scpTransferTabId
    ? tabs.find((t) => t.id === scpTransferTabId)
    : undefined
  const browserDevPreview = isBrowserDevPreview()
  const terminalActive = activeTab?.type === 'terminal'
  const terminalTabs = tabs.filter(
    (t) => t.type === 'terminal' && getAllTerminalIds(t).length > 0,
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {browserDevPreview && (
        <div
          className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1 text-center text-xs text-amber-900 dark:text-amber-200"
          role="status"
        >
          {t('app.browserDevPreview')}{' '}
          <code className="rounded bg-amber-500/15 px-1">npm run start</code>
        </div>
      )}
      <TitleBar />
      {minimalLayout && <MinimalTabBar />}
      <div className="flex min-h-0 flex-1">
        {!minimalLayout && <Sidebar />}
        <main className="flex min-w-0 flex-1 flex-col bg-background p-2">
          <div
            className={cn(
              'relative min-h-0 flex-1 overflow-hidden',
              terminalActive ? ui.mainPanelTerminal : ui.mainPanel,
            )}
          >
            {terminalTabs.map((tab) => (
              <TerminalTabLayer
                key={tab.id}
                tab={tab}
                isTabActive={tab.id === activeTabId}
              />
            ))}
            {activeTab?.type === 'settings' && (
              <div className="absolute inset-0">
                <Suspense fallback={null}>
                  <SettingsPanel />
                </Suspense>
              </div>
            )}
            {activeTab?.type === 'filesystem' && (
              <div className="absolute inset-0">
                <Suspense fallback={null}>
                  <FilesystemPanel />
                </Suspense>
              </div>
            )}
            {tabs.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {t('app.emptyHint')}
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar />
      <Toaster position="bottom-right" richColors closeButton />
      {scpTransferTab && isSshTerminalTab(scpTransferTab) && (
        <Suspense fallback={null}>
          <ScpTransferDialog
            tab={scpTransferTab}
            open
            onOpenChange={(open) => {
              if (!open) setScpTransferTabId(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
