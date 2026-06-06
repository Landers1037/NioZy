import { useTranslation } from 'react-i18next'
import { Plus, Settings, Link2, FolderCode, Braces, MessageSquare, GitBranch } from 'lucide-react'
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
import { SpecialTabItem } from '@/components/layout/SpecialTabItem'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'

export function MinimalTabBar() {
  const { t } = useTranslation()
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const addFilesystemTab = useAppStore((s) => s.addFilesystemTab)
  const addRepoTab = useAppStore((s) => s.addRepoTab)
  const addChatTab = useAppStore((s) => s.addChatTab)
  const addSandboxTab = useAppStore((s) => s.addSandboxTab)
  const settings = useAppStore((s) => s.settings)
  const jsSandboxEnabled = settings?.experimental.jsSandboxEnabled === true
  const localFilesystemEnabled = settings?.filesystem.localFilesystemEnabled !== false
  const repoManagementEnabled = settings?.filesystem.repoManagementEnabled === true
  const p2pChatEnabled = settings?.p2p.enabled === true
  const ui = useUiClasses()

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1.5 no-drag',
        ui.tabBarBg,
      )}
    >
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
            <SpecialTabItem
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void createTerminal()}
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
        {localFilesystemEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.filesystem')}
            onClick={() => addFilesystemTab()}
          >
            <FolderCode className="size-3" />
          </Button>
        )}
        {repoManagementEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.repoManagement')}
            onClick={() => addRepoTab()}
          >
            <GitBranch className="size-3" />
          </Button>
        )}
        {p2pChatEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.openChat')}
            onClick={() => addChatTab()}
          >
            <MessageSquare className="size-3" />
          </Button>
        )}
        {jsSandboxEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.openJsSandbox')}
            onClick={() => addSandboxTab()}
          >
            <Braces className="size-3" />
          </Button>
        )}
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
