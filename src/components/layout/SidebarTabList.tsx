import { useRef } from 'react'
import { useAppStore } from '@/stores/app-store'
import { TerminalTabItem } from '@/components/layout/TerminalTabItem'
import { SpecialTabItem } from '@/components/layout/SpecialTabItem'
import { useSidebarTabDrag } from '@/hooks/useSidebarTabDrag'

interface SidebarTabListProps {
  collapsed: boolean
}

export function SidebarTabList({ collapsed }: SidebarTabListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const settings = useAppStore((s) => s.settings)

  const showTerminalIndex = settings?.shell.showTerminalIndex ?? false
  const enableTabDrag = settings?.shell.enableTabDrag ?? false

  const {
    draggingTabId,
    dropIndex,
    onTabPointerDown,
    onTabPointerMove,
    onTabPointerUp,
    onTabPointerCancel,
    shouldSuppressClick,
  } = useSidebarTabDrag({ enabled: enableTabDrag && !collapsed, containerRef })

  let terminalIndex = 0

  return (
    <div ref={containerRef} className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 no-drag">
      {tabs.map((tab, index) => {
        const isTerminal = tab.type === 'terminal'
        if (isTerminal) terminalIndex += 1

        const tabIndex = isTerminal ? terminalIndex : undefined
        const isDragging = draggingTabId === tab.id
        const dragEnabled = enableTabDrag && !collapsed && isTerminal

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
      {dropIndex === tabs.length && draggingTabId ? (
        <div className="h-0.5 shrink-0 rounded-full bg-primary" />
      ) : null}
    </div>
  )
}
