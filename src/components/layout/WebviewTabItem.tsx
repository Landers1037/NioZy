import { Globe, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface WebviewTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

export function WebviewTabItem({
  tab,
  collapsed,
  iconOnly,
  isActive,
}: WebviewTabItemProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const removeTab = useAppStore((s) => s.removeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const label = tab.customTitle || tab.title

  const button = (
    <button
      type="button"
      title={label}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
        isActive ? ui.segmentActive : cn(ui.segmentInactive, 'font-normal hover:bg-muted'),
        collapsed && 'justify-center px-2',
      )}
    >
      <Globe className="size-4 shrink-0" />
      {!collapsed && !iconOnly && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              removeTab(tab.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                removeTab(tab.id)
              }
            }}
            aria-label={t('tab.closeAria', { title: label })}
          >
            <X className="size-3.5" />
          </span>
        </>
      )}
    </button>
  )

  if (collapsed) return button

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => removeTab(tab.id)}>{t('common.close')}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
