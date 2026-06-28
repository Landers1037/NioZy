import { useTranslation } from 'react-i18next'
import { Settings, Link2, FolderCode, Braces, MessageSquare, GitBranch, PenTool, LineSquiggle, History, Bot, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NewConnectionMenuContent } from '@/components/layout/NewConnectionMenuContent'
import { NewTerminalButton } from '@/components/layout/NewTerminalButton'
import { useAppStore } from '@/stores/app-store'
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SpecialTabItem } from '@/components/layout/SpecialTabItem'
import { TabGroupItem } from '@/components/layout/TabGroupItem'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import { useSidebarTabItems } from '@/hooks/useSidebarTabItems'
import { useTabGroupStore } from '@/stores/tab-group-store'

export function MinimalTabBar() {
  const { t } = useTranslation()
  const activeTabId = useAppStore((s) => s.activeTabId)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const addFilesystemTab = useAppStore((s) => s.addFilesystemTab)
  const addRepoTab = useAppStore((s) => s.addRepoTab)
  const addSessionTab = useAppStore((s) => s.addSessionTab)
  const addAgentTab = useAppStore((s) => s.addAgentTab)
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
  const niozyAgentEnabled = settings?.experimental.niozyAgentEnabled === true
  const ui = useUiClasses()

  const { sidebarItems, inGroupView } = useSidebarTabItems()
  const exitGroup = useTabGroupStore((s) => s.exitGroup)

  return (
    <div
      className={cn(
        'app-native-chrome flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1.5 no-drag',
        ui.tabBarBg,
      )}
    >
      {inGroupView ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          title={t('tab.backToOuter')}
          onClick={() => exitGroup()}
        >
          <ArrowLeft className="size-3" />
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-px">
        {sidebarItems.map((item) =>
          item.kind === 'group' ? (
            <TabGroupItem
              key={item.group.id}
              group={item.group}
              iconOnly
              isActive={false}
            />
          ) : item.tab.type === 'terminal' ? (
            <TerminalTabItem
              key={item.tab.id}
              tab={item.tab}
              iconOnly
              isActive={activeTabId === item.tab.id}
            />
          ) : (
            <SpecialTabItem
              key={item.tab.id}
              tab={item.tab}
              iconOnly
              isActive={activeTabId === item.tab.id}
            />
          ),
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
        <NewTerminalButton iconOnly />
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
        {agentSessionEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.sessionManagement')}
            onClick={() => addSessionTab()}
          >
            <History className="size-3" />
          </Button>
        )}
        {niozyAgentEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.agent')}
            onClick={() => addAgentTab()}
          >
            <Bot className="size-3" />
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
        {excalidrawEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.excalidraw')}
            onClick={() => addExcalidrawTab()}
          >
            <PenTool className="size-3" />
          </Button>
        )}
        {drawioEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={t('sidebar.drawio')}
            onClick={() => addDrawioTab()}
          >
            <LineSquiggle className="size-3" />
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
