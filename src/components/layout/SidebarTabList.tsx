import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, PackageOpen } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SpecialTabItem } from '@/components/layout/SpecialTabItem'
import { TabGroupItem } from '@/components/layout/TabGroupItem'
import { useSidebarTabDrag } from '@/hooks/useSidebarTabDrag'
import { useSidebarTabItems } from '@/hooks/useSidebarTabItems'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { Button } from '@/components/ui/button'
import { AnimatedSidebarViewSwap } from '@/components/ui/animated-panel-section'
import type { SidebarNavDirection } from '@/lib/panel-animations'

interface SidebarTabListProps {
  collapsed: boolean
}

export function SidebarTabList({ collapsed }: SidebarTabListProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const settings = useAppStore((s) => s.settings)
  const exitGroup = useTabGroupStore((s) => s.exitGroup)

  const { sidebarItems, activeGroup, inGroupView } = useSidebarTabItems()

  const showTerminalIndex = settings?.shell.showTerminalIndex ?? false
  const enableTabDrag = settings?.shell.enableTabDrag ?? false

  const viewKey = inGroupView && activeGroup ? activeGroup.id : 'outer'
  const prevViewKeyRef = useRef(viewKey)
  const navDirectionRef = useRef<SidebarNavDirection>('forward')
  if (prevViewKeyRef.current !== viewKey) {
    navDirectionRef.current = viewKey === 'outer' ? 'back' : 'forward'
    prevViewKeyRef.current = viewKey
  }
  const navDirection = navDirectionRef.current

  const {
    draggingTabId,
    dropIndex,
    onTabPointerDown,
    onTabPointerMove,
    onTabPointerUp,
    onTabPointerCancel,
    shouldSuppressClick,
  } = useSidebarTabDrag({ enabled: enableTabDrag && !collapsed && !inGroupView, containerRef })

  let terminalIndex = 0

  const groupHeader =
    inGroupView && activeGroup ? (
      collapsed ? (
        <div className="flex shrink-0 justify-center border-b border-border py-1.5 no-drag">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title={t('tab.backToOuter')}
            onClick={() => exitGroup()}
          >
            <ArrowLeft className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5 no-drag">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            title={t('tab.backToOuter')}
            onClick={() => exitGroup()}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <PackageOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs font-app-bold text-muted-foreground">
            {activeGroup.name}
          </span>
        </div>
      )
    ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatedSidebarViewSwap viewKey={viewKey} direction={navDirection}>
        {groupHeader}
        <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 no-drag">
          {sidebarItems.map((item, index) => {
            if (item.kind === 'group') {
              return (
                <div key={item.group.id} className="relative" data-sidebar-tab-id={item.group.id}>
                  <TabGroupItem group={item.group} collapsed={collapsed} isActive={false} />
                </div>
              )
            }

            const tab = item.tab
            const isTerminal = tab.type === 'terminal'
            if (isTerminal) terminalIndex += 1

            const tabIndex = isTerminal ? terminalIndex : undefined
            const isDragging = draggingTabId === tab.id
            const dragEnabled = enableTabDrag && !collapsed && isTerminal && !inGroupView

            return (
              <div key={tab.id} className="relative" data-sidebar-tab-id={tab.id}>
                {dropIndex === index && draggingTabId ? (
                  <div className="absolute -top-0.5 right-0 left-0 z-10 h-0.5 rounded-full bg-primary" />
                ) : null}
                {isTerminal ? (
                  <TerminalTabItem
                    tab={tab}
                    collapsed={collapsed}
                    isActive={activeTabId === tab.id}
                    terminalIndex={tabIndex}
                    showTerminalIndex={showTerminalIndex && !collapsed}
                    isDragging={isDragging}
                    dragModeActive={draggingTabId != null}
                    dragEnabled={dragEnabled}
                    onDragPointerDown={(e) => onTabPointerDown(tab.id, e)}
                    onDragPointerMove={onTabPointerMove}
                    onDragPointerUp={onTabPointerUp}
                    onDragPointerCancel={onTabPointerCancel}
                    shouldSuppressClick={shouldSuppressClick}
                  />
                ) : (
                  <SpecialTabItem
                    tab={tab}
                    collapsed={collapsed}
                    isActive={activeTabId === tab.id}
                  />
                )}
              </div>
            )
          })}
          {dropIndex === sidebarItems.length && draggingTabId ? (
            <div className="h-0.5 shrink-0 rounded-full bg-primary" />
          ) : null}
        </div>
      </AnimatedSidebarViewSwap>
    </div>
  )
}
