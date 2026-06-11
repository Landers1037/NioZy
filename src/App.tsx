import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
  useState,
  type ComponentType,
} from 'react'
import { useTranslation } from 'react-i18next'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MinimalTabBar } from '@/components/layout/MinimalTabBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { isMinimalLayout } from '@/lib/layout-mode'
import { useTerminalStreamSync } from '@/hooks/useTerminalStreamSync'
import { useSuperPowerSavingPtySync } from '@/hooks/useSuperPowerSavingPtySync'
import { useAttachPtyTabSwitch } from '@/hooks/useAttachPtyTabSwitch'
import { isAttachPtyRenderMode, resolveAttachPtyTargetTab } from '@/lib/attach-pty-render'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { AttachPtyTerminalHost } from '@/components/terminal/AttachPtyTerminalHost'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'
import { TerminalTabLayer } from '@/components/terminal/TerminalTabLayer'
import { FilePreviewDialog } from '@/components/preview/FilePreviewDialog'
import { LinkPreviewPanel } from '@/components/preview/LinkPreviewPanel'
import { getAllTerminalIds } from '@/lib/terminal-tab-utils'
import { useAppStore, applyThemeToDocument } from '@/stores/app-store'
import { useUiClasses } from '@/lib/ui-style'
import { createTerminal, handleOpenDirectoryPayload } from '@/lib/terminal-actions'
import { waitForTerminalFonts } from '@/lib/terminal-webgl-refresh'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { getElectronAPI, isBrowserDevPreview, isElectron } from '@/lib/electron-client'
import { useAppShortcuts } from '@/hooks/useAppShortcuts'
import { useSshDisconnectAlert } from '@/hooks/useSshDisconnectAlert'
import { useResourceAutoDegradeMonitor } from '@/hooks/useResourceAutoDegradeMonitor'
import { useReminderAlerts } from '@/hooks/useReminderAlerts'
import { ReminderDueDialog } from '@/components/reminder/ReminderDueDialog'
import { cn } from '@/lib/utils'
import { resolveAiSidebarWidthPx } from '@/lib/ai-sidebar-width'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'
import { DrawingPanelFallback } from '@/components/drawing/DrawingPanelFallback'
import { AnimatedTabPanel } from '@/components/ui/animated-tab-panel'
import {
  AnimatedMinimalTabBar,
  AnimatedSidebarSlot,
} from '@/components/ui/animated-layout-chrome'

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
const JsSandboxPanel = lazy(() =>
  import('@/components/sandbox/JsSandboxPanel').then((m) => ({
    default: m.JsSandboxPanel,
  })),
)
const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then((m) => ({
    default: m.ChatPanel,
  })),
)
const ScpTransferDialog = lazy(() =>
  import('@/components/scp/ScpTransferDialog').then((m) => ({
    default: m.ScpTransferDialog,
  })),
)
const VncPanel = lazy(() =>
  import('@/components/vnc/VncPanel').then((m) => ({
    default: m.VncPanel,
  })),
)
const RepoManagementPanel = lazy(() =>
  import('@/components/repo/RepoManagementPanel').then((m) => ({
    default: m.RepoManagementPanel,
  })),
)
const ExcalidrawPanel = lazy(() =>
  import('@/components/drawing/ExcalidrawPanel').then((m) => ({
    default: m.ExcalidrawPanel,
  })),
)
const DrawioPanel = lazy(() =>
  import('@/components/drawing/DrawioPanel').then((m) => ({
    default: m.DrawioPanel,
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
  const bootInFlight = useRef(false)

  useAppShortcuts()
  useSshDisconnectAlert()
  useReminderAlerts()
  useResourceAutoDegradeMonitor()
  useTerminalStreamSync(tabs, activeTabId)
  useSuperPowerSavingPtySync(tabs, activeTabId)
  useAttachPtyTabSwitch(tabs, activeTabId)

  useEffect(() => {
    if (activeTabId) touchTabActivity(activeTabId)
  }, [activeTabId])

  useEffect(() => {
    let cancelled = false
    let unsubMax: (() => void) | undefined
    let unsubSettings: (() => void) | undefined

    const setup = (): boolean => {
      if (cancelled || !isElectron()) return false
      const api = getElectronAPI()
      api.window.isMaximized().then((v) => {
        if (!cancelled) setWindowMaximized(v)
      })
      unsubMax = api.window.onMaximized(setWindowMaximized)
      unsubSettings = api.settings.onChanged((s) => {
        if (!cancelled) {
          setSettings(s)
          applyThemeToDocument(s)
        }
      })

      if (!booted.current && !bootInFlight.current) {
        bootInFlight.current = true
        void (async () => {
          try {
            const s = await api.settings.get()
            if (cancelled) return
            setSettings(s)
            applyThemeToDocument(s)

            const [, pending] = await Promise.all([
              s.terminal?.useBuiltinFont
                ? waitForTerminalFonts(s.terminal)
                : Promise.resolve(),
              api.app.getPendingOpenDirectory(),
            ])
            if (cancelled) return
            if (pending) await handleOpenDirectoryPayload(pending)
            else await createTerminal()

            if (!cancelled) booted.current = true
          } finally {
            bootInFlight.current = false
          }
        })()
      } else if (booted.current) {
        void api.settings.get().then((s) => {
          if (!cancelled) {
            setSettings(s)
            applyThemeToDocument(s)
          }
        })
      }
      return true
    }

    const cleanupSetup = () => {
      cancelled = true
      if (!booted.current) bootInFlight.current = false
      unsubMax?.()
      unsubSettings?.()
    }

    if (setup()) {
      return cleanupSetup
    }

    const timer = window.setInterval(() => {
      if (setup()) window.clearInterval(timer)
    }, 50)
    const timeout = window.setTimeout(() => window.clearInterval(timer), 5000)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      cleanupSetup()
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
    const unsubOpenDir = api.app.onOpenDirectory((payload) => {
      void handleOpenDirectoryPayload(payload)
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

  const scpTransferTabId = useAppStore((s) => s.scpTransferTabId)
  const setScpTransferTabId = useAppStore((s) => s.setScpTransferTabId)
  const attachCommitted = useAttachPtySessionStore((s) => s.committed)
  const attachPendingTabId = useAttachPtySessionStore((s) => s.pendingTabId)
  const aiSidebarOpen = useAiSidebarStore((s) => s.isOpen)
  const [AiCopilotRoot, setAiCopilotRoot] = useState<ComponentType | null>(null)
  const [aiMountKey, setAiMountKey] = useState(0)

  const terminalTabs = useMemo(
    () => tabs.filter((t) => t.type === 'terminal' && getAllTerminalIds(t).length > 0),
    [tabs],
  )

  const tabLayout = useMemo(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    const activeType = activeTab?.type
    const scpTransferTab = scpTransferTabId
      ? tabs.find((t) => t.id === scpTransferTabId)
      : undefined
    const attachTargetTab = resolveAttachPtyTargetTab(activeTabId, tabs)
    const attachPtyMode = isAttachPtyRenderMode(settings)

    return {
      activeTab,
      scpTransferTab,
      terminalActive: activeType === 'terminal',
      hasSettingsTab: tabs.some((t) => t.type === 'settings'),
      settingsTabActive: activeType === 'settings',
      hasFilesystemTab: tabs.some((t) => t.type === 'filesystem'),
      filesystemTabActive: activeType === 'filesystem',
      hasSandboxTab: tabs.some((t) => t.type === 'sandbox'),
      sandboxTabActive: activeType === 'sandbox',
      hasChatTab: tabs.some((t) => t.type === 'chat'),
      chatTabActive: activeType === 'chat',
      hasRepoTab: tabs.some((t) => t.type === 'repo'),
      repoTabActive: activeType === 'repo',
      hasExcalidrawTab: tabs.some((t) => t.type === 'excalidraw'),
      excalidrawTabActive: activeType === 'excalidraw',
      hasDrawioTab: tabs.some((t) => t.type === 'drawio'),
      drawioTabActive: activeType === 'drawio',
      excalidrawEnabled: settings?.drawing?.excalidrawEnabled === true,
      drawioEnabled: settings?.drawing?.drawioEnabled === true,
      p2pChatEnabled: settings?.p2p.enabled === true,
      hasVncTab: tabs.some((t) => t.type === 'vnc'),
      vncTabActive: activeType === 'vnc',
      showAttachPtyHost:
        attachPtyMode &&
        !!attachCommitted &&
        !attachPendingTabId &&
        !!attachTargetTab &&
        attachCommitted.tabId === attachTargetTab.id,
      aiSidebarEnabled: settings?.experimental.aiSidebarEnabled === true,
      aiSidebarWidthPx: resolveAiSidebarWidthPx(
        settings?.experimental.aiSidebarWidth ?? 'default',
      ),
    }
  }, [
    tabs,
    activeTabId,
    scpTransferTabId,
    settings,
    attachCommitted,
    attachPendingTabId,
  ])

  const {
    activeTab,
    scpTransferTab,
    terminalActive,
    hasSettingsTab,
    settingsTabActive,
    hasFilesystemTab,
    filesystemTabActive,
    hasSandboxTab,
    sandboxTabActive,
    hasChatTab,
    chatTabActive,
    hasRepoTab,
    repoTabActive,
    hasExcalidrawTab,
    excalidrawTabActive,
    hasDrawioTab,
    drawioTabActive,
    excalidrawEnabled,
    drawioEnabled,
    p2pChatEnabled,
    hasVncTab,
    vncTabActive,
    showAttachPtyHost,
    aiSidebarEnabled,
    aiSidebarWidthPx,
  } = tabLayout

  const browserDevPreview = isBrowserDevPreview()

  const handleScpTransferOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setScpTransferTabId(null)
    },
    [setScpTransferTabId],
  )

  useEffect(() => {
    if (!aiSidebarEnabled) {
      useAiSidebarStore.getState().reset()
      document.body.style.marginInlineEnd = ''
      document.body.style.marginInlineStart = ''
      document.body.style.transition = ''
      setAiCopilotRoot(null)
      return
    }

    let cancelled = false
    void import('@/components/ai/AiCopilotRoot').then((m) => {
      if (!cancelled) setAiCopilotRoot(() => m.AiCopilotRoot)
    })

    return () => {
      cancelled = true
      setAiCopilotRoot(null)
      useAiSidebarStore.getState().reset()
      document.body.style.marginInlineEnd = ''
      document.body.style.marginInlineStart = ''
      document.body.style.transition = ''
      setAiMountKey((k) => k + 1)
    }
  }, [aiSidebarEnabled])

  if (!isElectron()) {
    return null
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-background',
        aiSidebarEnabled &&
          aiSidebarOpen &&
          'transition-[padding-inline-end] duration-300 ease-out',
      )}
      style={
        aiSidebarEnabled && aiSidebarOpen
          ? { paddingInlineEnd: aiSidebarWidthPx }
          : undefined
      }
    >
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
      <AnimatedMinimalTabBar show={minimalLayout}>
        <MinimalTabBar />
      </AnimatedMinimalTabBar>
      <div className="flex min-h-0 flex-1">
        <AnimatedSidebarSlot show={!minimalLayout}>
          <Sidebar />
        </AnimatedSidebarSlot>
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
            {showAttachPtyHost && <AttachPtyTerminalHost />}
            {hasSettingsTab && (
              <AnimatedTabPanel active={settingsTabActive}>
                <SettingsPanel />
              </AnimatedTabPanel>
            )}
            {hasFilesystemTab && (
              <AnimatedTabPanel active={filesystemTabActive}>
                <FilesystemPanel />
              </AnimatedTabPanel>
            )}
            {hasSandboxTab && (
              <AnimatedTabPanel active={sandboxTabActive}>
                <JsSandboxPanel />
              </AnimatedTabPanel>
            )}
            {hasChatTab && p2pChatEnabled && (
              <AnimatedTabPanel active={chatTabActive}>
                <ChatPanel />
              </AnimatedTabPanel>
            )}
            {hasRepoTab && (
              <AnimatedTabPanel active={repoTabActive}>
                <RepoManagementPanel />
              </AnimatedTabPanel>
            )}
            {hasExcalidrawTab && excalidrawEnabled && (
              <div
                className={cn(
                  'absolute inset-0',
                  !excalidrawTabActive && 'pointer-events-none invisible',
                )}
                {...(!excalidrawTabActive ? { inert: true } : {})}
              >
                <Suspense fallback={<DrawingPanelFallback />}>
                  <ExcalidrawPanel />
                </Suspense>
              </div>
            )}
            {hasDrawioTab && drawioEnabled && (
              <div
                className={cn(
                  'absolute inset-0',
                  !drawioTabActive && 'pointer-events-none invisible',
                )}
                {...(!drawioTabActive ? { inert: true } : {})}
              >
                <Suspense fallback={<DrawingPanelFallback />}>
                  <DrawioPanel />
                </Suspense>
              </div>
            )}
            {activeTab?.type === 'webview' && activeTab.webviewUrl && (
              <div className="absolute inset-0">
                <LinkPreviewPanel tab={activeTab} />
              </div>
            )}
            {hasVncTab && (
              <div
                className={cn(
                  'absolute inset-0',
                  !vncTabActive && 'pointer-events-none invisible',
                )}
                {...(!vncTabActive ? { inert: true } : {})}
              >
                <Suspense fallback={null}>
                  {activeTab?.type === 'vnc' && activeTab.vncConnectionId ? (
                    <VncPanel tabId={activeTab.id} connectionId={activeTab.vncConnectionId} />
                  ) : null}
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
      <FilePreviewDialog />
      <ReminderDueDialog />
      {aiSidebarEnabled && AiCopilotRoot && (
        <Suspense key={aiMountKey} fallback={null}>
          <AiCopilotRoot />
        </Suspense>
      )}
      {scpTransferTab && isSshTerminalTab(scpTransferTab) && (
        <Suspense fallback={null}>
          <ScpTransferDialog
            tab={scpTransferTab}
            open
            onOpenChange={handleScpTransferOpenChange}
          />
        </Suspense>
      )}
    </div>
  )
}
