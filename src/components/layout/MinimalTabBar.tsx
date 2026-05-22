import { useTranslation } from 'react-i18next'
import { Plus, Settings, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NewConnectionMenuContent } from '@/components/layout/NewConnectionMenuContent'
import { useAppStore } from '@/stores/app-store'
import { createTerminal } from '@/lib/terminal-actions'
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SettingsTabItem } from '@/components/layout/SettingsTabItem'

export function MinimalTabBar() {
  const { t } = useTranslation()
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5 no-drag">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-px">
        {tabs.map((tab) =>
          tab.type === 'terminal' ? (
            <TerminalTabItem
              key={tab.id}
              tab={tab}
              iconOnly
              isActive={activeTabId === tab.id}
            />
          ) : (
            <SettingsTabItem
              key={tab.id}
              tab={tab}
              iconOnly
              isActive={activeTabId === tab.id}
            />
          ),
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-6"
          title={t('sidebar.newPowerShell')}
          onClick={() => createTerminal()}
        >
          <Plus className="size-3" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-6"
              title={t('sidebar.newConnection')}
            >
              <Link2 className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <NewConnectionMenuContent />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          title={t('sidebar.settings')}
          onClick={() => addSettingsTab()}
        >
          <Settings className="size-3" />
        </Button>
      </div>
    </div>
  )
}
