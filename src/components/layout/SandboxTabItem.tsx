import { useTranslation } from 'react-i18next'
import { Braces, FolderOpen, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { getTabHighlightClasses } from '@/lib/tab-display'
import { getTabCornerRadius, useUiStyle } from '@/lib/ui-style'

interface SandboxTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

export function SandboxTabItem({
  tab,
  collapsed = false,
  iconOnly = false,
  isActive,
}: SandboxTabItemProps) {
  const { t } = useTranslation()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const uiStyle = useUiStyle()

  const compact = collapsed || iconOnly

  const row = (
    <div
      title={tab.title}
      className={cn(
        'group flex cursor-pointer items-center transition-colors',
        iconOnly
          ? cn('size-6 shrink-0 justify-center', getTabCornerRadius(uiStyle))
          : cn(getTabCornerRadius(uiStyle), 'py-1.5', compact ? 'justify-center px-0' : 'gap-2 px-2'),
        getTabHighlightClasses(isActive, iconOnly, uiStyle),
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <Braces className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{tab.title}</span>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            aria-label={t('tab.closeAria', { title: tab.title })}
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
          <FolderOpen className="size-4 text-muted-foreground" />
          {t('common.open')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => removeTab(tab.id)}>
          <X className="size-4 text-muted-foreground" />
          {t('common.close')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
