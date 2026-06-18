import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { useWorkspaceSession, useWorkspaceStore } from '@/stores/workspace-store'
import { TerminalView } from '@/components/terminal/TerminalView'
import { WorkspaceFileTree } from '@/components/workspace/WorkspaceFileTree'
import { WorkspaceGitView } from '@/components/workspace/WorkspaceGitView'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import { setLayoutResizing } from '@/lib/layout-resize'
import { panelEnterTransition, usePanelAnimationEnabled } from '@/lib/panel-animations'

const MIN_TERMINAL_WIDTH_PERCENT = 40
const MAX_TERMINAL_WIDTH_PERCENT = 85

interface WorkspaceActiveViewProps {
  tab: AppTab
  isTabActive: boolean
}

export function WorkspaceActiveView({ tab, isTabActive }: WorkspaceActiveViewProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const panelAnimate = usePanelAnimationEnabled()
  const gitWorkspaceEnabled = useAppStore(
    (s) => s.settings?.workspace.gitWorkspaceEnabled === true,
  )
  const session = useWorkspaceSession(tab.id)
  const setRightPanel = useWorkspaceStore((s) => s.setRightPanel)
  const setRightPanelCollapsed = useWorkspaceStore((s) => s.setRightPanelCollapsed)
  const ensureWorkspaceTerminal = useWorkspaceStore((s) => s.ensureWorkspaceTerminal)
  const resetWorkspaceSession = useWorkspaceStore((s) => s.resetWorkspaceSession)
  const terminalEnsureStartedRef = useRef(false)

  const [terminalWidthPercent, setTerminalWidthPercent] = useState(62)
  const [isResizing, setIsResizing] = useState(false)
  const [terminalStarting, setTerminalStarting] = useState(false)

  const rightPanelCollapsed = session.rightPanelCollapsed

  useEffect(() => {
    if (!session.isStarted || session.terminalId) {
      terminalEnsureStartedRef.current = false
      return
    }
    if (terminalEnsureStartedRef.current) return
    terminalEnsureStartedRef.current = true
    setTerminalStarting(true)
    void ensureWorkspaceTerminal(tab.id)
      .then((result) => {
        if (result.ok) return
        toast.error(result.error)
        resetWorkspaceSession(tab.id)
        useAppStore.getState().patchWorkspaceTab(tab.id, { terminalId: undefined })
      })
      .finally(() => {
        setTerminalStarting(false)
        terminalEnsureStartedRef.current = false
      })
  }, [
    ensureWorkspaceTerminal,
    resetWorkspaceSession,
    session.isStarted,
    session.terminalId,
    tab.id,
  ])

  const workspaceTab = useMemo((): AppTab => {
    return {
      ...tab,
      workspaceDir: session.workingDir,
      terminalId: session.terminalId ?? undefined,
    }
  }, [tab, session.workingDir, session.terminalId])

  if (!session.terminalId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {terminalStarting ? <Loader2 className="size-6 animate-spin" aria-hidden /> : null}
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <div
        className="relative h-full min-h-0 min-w-0 shrink-0 overflow-hidden"
        style={{ width: rightPanelCollapsed ? '100%' : `${terminalWidthPercent}%` }}
      >
        <TerminalView tab={workspaceTab} isFocused={isTabActive} />
      </div>

      {!rightPanelCollapsed && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            className={cn(
              'relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none',
              ui.sidebarResizeHover,
              isResizing && ui.sidebarResizeActive,
            )}
            onPointerDown={(e) => {
              const parent = e.currentTarget.parentElement
              if (!parent) return
              const rect = parent.getBoundingClientRect()
              const startX = e.clientX
              const startPercent = terminalWidthPercent
              e.currentTarget.setPointerCapture(e.pointerId)
              setIsResizing(true)
              setLayoutResizing(true)
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
              const onMove = (ev: PointerEvent) => {
                const delta = ev.clientX - startX
                const next = Math.min(
                  MAX_TERMINAL_WIDTH_PERCENT,
                  Math.max(MIN_TERMINAL_WIDTH_PERCENT, startPercent + (delta / rect.width) * 100),
                )
                setTerminalWidthPercent(next)
              }
              const finish = () => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                setIsResizing(false)
                setLayoutResizing(false)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
                e.currentTarget.removeEventListener('pointermove', onMove)
                e.currentTarget.removeEventListener('pointerup', finish)
                e.currentTarget.removeEventListener('pointercancel', finish)
              }
              e.currentTarget.addEventListener('pointermove', onMove)
              e.currentTarget.addEventListener('pointerup', finish)
              e.currentTarget.addEventListener('pointercancel', finish)
            }}
          />

          <motion.div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-border"
            initial={panelAnimate ? { x: 24, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            transition={panelAnimate ? panelEnterTransition : { duration: 0 }}
          >
            <div
              className={cn(
                'flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5',
                gitWorkspaceEnabled && ui.segmentGroupBg,
              )}
            >
              {gitWorkspaceEnabled ? (
                <div className="flex min-w-0 flex-1 gap-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1 text-sm transition-colors',
                      session.rightPanel === 'files'
                        ? cn(ui.segmentActive, 'font-app-bold')
                        : cn(ui.segmentInactive, 'font-app-regular'),
                    )}
                    onClick={() => setRightPanel(tab.id, 'files')}
                  >
                    {t('workspace.fileTree')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1 text-sm transition-colors',
                      session.rightPanel === 'git'
                        ? cn(ui.segmentActive, 'font-app-bold')
                        : cn(ui.segmentInactive, 'font-app-regular'),
                    )}
                    onClick={() => setRightPanel(tab.id, 'git')}
                  >
                    {t('workspace.gitWorkspace')}
                  </button>
                </div>
              ) : (
                <span className="min-w-0 flex-1 truncate px-1 text-sm font-app-bold text-muted-foreground">
                  {t('workspace.fileTree')}
                </span>
              )}
              <button
                type="button"
                className={cn(
                  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                )}
                aria-label={t('workspace.collapsePanel')}
                title={t('workspace.collapsePanel')}
                onClick={() => setRightPanelCollapsed(tab.id, true)}
              >
                <PanelRightClose className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {!gitWorkspaceEnabled || session.rightPanel === 'files' ? (
                <WorkspaceFileTree tabId={tab.id} rootPath={session.workingDir} />
              ) : (
                <WorkspaceGitView tabId={tab.id} />
              )}
            </div>
          </motion.div>
        </>
      )}

      {rightPanelCollapsed && (
        <button
          type="button"
          className={cn(
            'absolute right-3 top-3 z-20 flex size-9 cursor-pointer items-center justify-center rounded-full border border-border shadow-sm transition-colors hover:bg-muted',
            ui.mainPanel,
          )}
          aria-label={t('workspace.expandPanel')}
          title={t('workspace.expandPanel')}
          onClick={() => setRightPanelCollapsed(tab.id, false)}
        >
          <PanelRightOpen className="size-4 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
