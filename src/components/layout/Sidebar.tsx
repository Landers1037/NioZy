import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Terminal,
  X,
  Link2,
} from 'lucide-react'
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
import { getElectronAPI } from '@/lib/electron-client'

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
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
        {!collapsed && <span className="px-1 text-xs font-medium text-muted-foreground">终端</span>}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 no-drag">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'group flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors',
              activeTabId === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-card/60',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.type === 'settings' ? (
              <Settings className="size-4 shrink-0" />
            ) : (
              <Terminal className="size-4 shrink-0" />
            )}
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">{tab.title}</span>
                <button
                  type="button"
                  className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  aria-label={`关闭 ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (tab.type === 'terminal' && tab.terminalId) {
                      getElectronAPI().terminal.kill(tab.terminalId)
                    }
                    removeTab(tab.id)
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-border p-2 no-drag">
        <div className={cn('flex gap-1', collapsed && 'flex-col')}>
          <Button
            variant="secondary"
            size={collapsed ? 'icon' : 'default'}
            className={cn(!collapsed && 'flex-1')}
            onClick={() => createTerminal('powershell')}
            title="新建 PowerShell"
          >
            <Plus className="size-4" />
            {!collapsed && '新建终端'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={collapsed ? 'icon' : 'default'} title="新建连接">
                <Link2 className="size-4" />
                {!collapsed && '连接'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => createConnection('powershell')}>
                PowerShell
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createConnection('cmd')}>CMD</DropdownMenuItem>
              <DropdownMenuItem onClick={() => createConnection('pwsh')}>
                PowerShell Core (pwsh)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {settings?.connections.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => createConnection('custom', c)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
              {settings?.connections.length === 0 && (
                <DropdownMenuItem disabled>暂无自定义连接</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn('justify-start', collapsed && 'justify-center')}
          onClick={() => addSettingsTab()}
        >
          <Settings className="size-4" />
          {!collapsed && '设置'}
        </Button>
      </div>
    </aside>
  )
}
