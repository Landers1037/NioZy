import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MinimalTabBar } from '@/components/layout/MinimalTabBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { isMinimalLayout } from '@/lib/layout-mode'
import { SplitTerminalPanel } from '@/components/terminal/SplitTerminalPanel'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { FilesystemPanel } from '@/components/filesystem/FilesystemPanel'
import { useAppStore, applyThemeToDocument } from '@/stores/app-store'
import { useUiClasses } from '@/lib/ui-style'
import { createTerminal, openTerminalInDirectory } from '@/lib/terminal-actions'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { getElectronAPI, isBrowserDevPreview, isElectron } from '@/lib/electron-client'
import { useAppShortcuts } from '@/hooks/useAppShortcuts'
import { useSshDisconnectAlert } from '@/hooks/useSshDisconnectAlert'
import { ScpTransferDialog } from '@/components/scp/ScpTransferDialog'
import { cn } from '@/lib/utils'

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
    return () => {
      unsubCwd()
      unsubExit()
      unsubOpenDir()
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
            {activeTab?.type === 'terminal' && activeTab.terminalId && (
              <div key={activeTab.id} className="absolute inset-0">
                <SplitTerminalPanel tab={activeTab} />
              </div>
            )}
            {activeTab?.type === 'settings' && (
              <div className="absolute inset-0">
                <SettingsPanel />
              </div>
            )}
            {activeTab?.type === 'filesystem' && (
              <div className="absolute inset-0">
                <FilesystemPanel />
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
        <ScpTransferDialog
          tab={scpTransferTab}
          open
          onOpenChange={(open) => {
            if (!open) setScpTransferTabId(null)
          }}
        />
      )}
    </div>
  )
}
