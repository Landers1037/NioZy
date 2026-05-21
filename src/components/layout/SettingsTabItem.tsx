import { Settings, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { getTabHighlightClasses } from '@/lib/tab-display'

interface SettingsTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

export function SettingsTabItem({
  tab,
  collapsed = false,
  iconOnly = false,
  isActive,
}: SettingsTabItemProps) {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)

  const compact = collapsed || iconOnly

  const row = (
    <div
      title={tab.title}
      className={cn(
        'group flex cursor-pointer items-center transition-colors',
        iconOnly
          ? 'size-6 shrink-0 justify-center rounded-md'
          : cn('rounded-[10px] py-1.5', compact ? 'justify-center px-0' : 'gap-2 px-2'),
        getTabHighlightClasses(isActive, iconOnly),
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <Settings className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{tab.title}</span>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            aria-label={`关闭 ${tab.title}`}
            onClick={(e) => {
              e.stopPropagation()
              removeTab(tab.id)
            }}
          >
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            if (!isActive) setActiveTab(tab.id)
          }}
        >
          打开
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => removeTab(tab.id)}>关闭</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
