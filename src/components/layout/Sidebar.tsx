import { useCallback } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus, Settings, Link2, FolderCode, Braces, MessageSquare, GitBranch, PenTool, LineSquiggle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NewConnectionMenuContent } from '@/components/layout/NewConnectionMenuContent'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { createTerminal } from '@/lib/terminal-actions'
import { SidebarTabList } from '@/components/layout/SidebarTabList'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { DEFAULT_SIDEBAR_WIDTH } from '../../../electron/shared/sidebar-width'
import { useUiClasses } from '@/lib/ui-style'
import { sidebarWidthTransition, usePanelAnimationEnabled } from '@/lib/panel-animations'

export function Sidebar() {
  const { t } = useTranslation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const addFilesystemTab = useAppStore((s) => s.addFilesystemTab)
  const addRepoTab = useAppStore((s) => s.addRepoTab)
  const addSessionTab = useAppStore((s) => s.addSessionTab)
  const addChatTab = useAppStore((s) => s.addChatTab)
  const addSandboxTab = useAppStore((s) => s.addSandboxTab)
  const addExcalidrawTab = useAppStore((s) => s.addExcalidrawTab)
  const addDrawioTab = useAppStore((s) => s.addDrawioTab)
  const settings = useAppStore((s) => s.settings)
  const jsSandboxEnabled = settings?.experimental.jsSandboxEnabled === true
  const excalidrawEnabled = settings?.drawing?.excalidrawEnabled === true
  const drawioEnabled = settings?.drawing?.drawioEnabled === true
  const localFilesystemEnabled = settings?.filesystem.localFilesystemEnabled !== false
  const repoManagementEnabled = settings?.filesystem.repoManagementEnabled === true
  const agentSessionEnabled = settings?.session.agentSessionEnabled === true
  const p2pChatEnabled = settings?.p2p.enabled === true
  const patchSettings = useAppStore((s) => s.patchSettings)

  const storedWidth = settings?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH

  const commitWidth = useCallback(
    (sidebarWidth: number) => {
      void patchSettings({ sidebarWidth })
    },
    [patchSettings],
  )

  const ui = useUiClasses()
  const panelAnimate = usePanelAnimationEnabled()

  const { containerRef, displayWidth, isResizing, startResize } = useSidebarResize({
    width: storedWidth,
    collapsed,
    onCommit: commitWidth,
  })

  return (
    <motion.div
      ref={containerRef}
      className="relative flex h-full shrink-0 overflow-hidden"
      initial={false}
      animate={{ width: displayWidth }}
      transition={
        panelAnimate && !isResizing ? sidebarWidthTransition : { duration: 0 }
      }
    >
      <aside
        className={cn(
          'flex h-full w-full min-w-0 select-none flex-col overflow-hidden border-r border-border',
          ui.sidebarBg,
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-2 no-drag">
          {!collapsed && (
            <span className="px-1 text-xs font-app-bold text-muted-foreground">
              {t('sidebar.terminals')}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <SidebarTabList collapsed={collapsed} />

        <div
          className={cn(
            'flex min-w-0 flex-col gap-1 overflow-hidden border-t border-border p-2 no-drag',
            collapsed && 'items-center',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 gap-1',
              collapsed ? 'flex-col items-center' : 'w-full',
            )}
          >
            <Button
              variant="secondary"
              size={collapsed ? 'icon' : 'default'}
              className={cn(
                !collapsed && 'min-w-0 flex-1 basis-0 overflow-hidden px-2',
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void createTerminal()}
              title={t('sidebar.newPowerShell')}
            >
              <Plus className="size-4 shrink-0" />
              {!collapsed && (
                <span className="min-w-0 truncate">{t('sidebar.newTerminal')}</span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size={collapsed ? 'icon' : 'default'}
                  className={cn(
                    !collapsed && 'min-w-0 flex-1 basis-0 overflow-hidden px-2',
                  )}
                  title={t('sidebar.newConnection')}
                >
                  <Link2 className="size-4 shrink-0" />
                  {!collapsed && (
                    <span className="min-w-0 truncate">{t('sidebar.connection')}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <NewConnectionMenuContent />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            className={cn(
              'flex min-w-0 gap-1',
              collapsed ? 'flex-col items-center' : 'w-full flex-col',
            )}
          >
            {localFilesystemEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addFilesystemTab()}
              >
                <FolderCode className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.filesystem')}</span>
                )}
              </Button>
            )}
            {repoManagementEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addRepoTab()}
              >
                <GitBranch className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.repoManagement')}</span>
                )}
              </Button>
            )}
            {agentSessionEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addSessionTab()}
              >
                <History className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.sessionManagement')}</span>
                )}
              </Button>
            )}
            {p2pChatEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addChatTab()}
              >
                <MessageSquare className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.openChat')}</span>
                )}
              </Button>
            )}
            {jsSandboxEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addSandboxTab()}
                title={t('sidebar.openJsSandbox')}
              >
                <Braces className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.openJsSandbox')}</span>
                )}
              </Button>
            )}
            {excalidrawEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addExcalidrawTab()}
              >
                <PenTool className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.excalidraw')}</span>
                )}
              </Button>
            )}
            {drawioEnabled && (
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
                onClick={() => addDrawioTab()}
              >
                <LineSquiggle className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 truncate">{t('sidebar.drawio')}</span>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              className={cn(!collapsed && 'w-full min-w-0 justify-start overflow-hidden px-2')}
              onClick={() => addSettingsTab()}
            >
              <Settings className="size-4 shrink-0" />
              {!collapsed && (
                <span className="min-w-0 truncate">{t('sidebar.settings')}</span>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('sidebar.resize')}
          title={t('sidebar.resize')}
          className={cn(
            'absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none no-drag',
            ui.sidebarResizeHover,
            isResizing && ui.sidebarResizeActive,
          )}
          onPointerDown={startResize}
        />
      )}
    </motion.div>
  )
}
