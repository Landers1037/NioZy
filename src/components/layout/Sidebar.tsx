import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus, Settings, Link2 } from 'lucide-react'
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
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { DEFAULT_SIDEBAR_WIDTH } from '../../../electron/shared/sidebar-width'
import { useUiClasses } from '@/lib/ui-style'

export function Sidebar() {
  const { t } = useTranslation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)

  const storedWidth = settings?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH

  const commitWidth = useCallback(
    (sidebarWidth: number) => {
      void patchSettings({ sidebarWidth })
    },
    [patchSettings],
  )

  const ui = useUiClasses()

  const { displayWidth, isResizing, startResize } = useSidebarResize({
    width: storedWidth,
    collapsed,
    onCommit: commitWidth,
  })

  return (
    <div
      className="relative flex h-full shrink-0"
      style={{ width: displayWidth }}
    >
      <aside
        className={cn(
          'flex h-full w-full min-w-0 select-none flex-col overflow-hidden border-r border-border',
          ui.sidebarBg,
          !isResizing && 'transition-[width] duration-200',
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-2 no-drag">
          {!collapsed && (
            <span className="px-1 text-xs font-semibold text-muted-foreground">
              {t('sidebar.terminals')}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 no-drag">
          {tabs.map((tab) =>
            tab.type === 'terminal' ? (
              <TerminalTabItem
                key={tab.id}
                tab={tab}
                collapsed={collapsed}
                isActive={activeTabId === tab.id}
              />
            ) : (
              <SettingsTabItem
                key={tab.id}
                tab={tab}
                collapsed={collapsed}
                isActive={activeTabId === tab.id}
              />
            ),
          )}
        </div>

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
              onClick={() => createTerminal()}
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
    </div>
  )
}
