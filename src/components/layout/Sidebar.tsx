import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus, Settings, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { createTerminal, createConnection } from '@/lib/terminal-actions'
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'

export function Sidebar() {
  const { t } = useTranslation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const settings = useAppStore((s) => s.settings)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-muted/50 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-2 no-drag">
        {!collapsed && (
          <span className="px-1 text-xs font-medium text-muted-foreground">
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
          'flex flex-col gap-1 border-t border-border p-2 no-drag',
          collapsed && 'items-center',
        )}
      >
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : '')}>
          <Button
            variant="secondary"
            size={collapsed ? 'icon' : 'default'}
            className={cn(!collapsed && 'flex-1')}
            onClick={() => createTerminal('powershell')}
            title={t('sidebar.newPowerShell')}
          >
            <Plus className="size-4" />
            {!collapsed && t('sidebar.newTerminal')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size={collapsed ? 'icon' : 'default'}
                title={t('sidebar.newConnection')}
              >
                <Link2 className="size-4" />
                {!collapsed && t('sidebar.connection')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => createConnection('powershell')}>
                {t('settings.connections.shell.powershell')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createConnection('cmd')}>
                {t('settings.connections.shell.cmd')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createConnection('pwsh')}>
                {t('settings.connections.shell.pwsh')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {settings?.connections.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => createConnection('custom', c)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
              {settings?.connections.length === 0 && (
                <DropdownMenuItem disabled>
                  {t('settings.connections.noCustomConnections')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn(!collapsed && 'w-full justify-start')}
          onClick={() => addSettingsTab()}
        >
          <Settings className="size-4" />
          {!collapsed && t('sidebar.settings')}
        </Button>
      </div>
    </aside>
  )
}
