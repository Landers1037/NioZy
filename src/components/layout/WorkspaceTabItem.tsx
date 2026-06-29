import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Computer, FolderOpen, Pencil, Sparkle, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { useWorkspaceSession } from '@/stores/workspace-store'
import { closeWorkspaceTab } from '@/lib/workspace-actions'
import { cn } from '@/lib/utils'
import { getTabHighlightClasses } from '@/lib/tab-display'
import { getTabCornerRadius, useUiStyle } from '@/lib/ui-style'
import { scheduleOverlayOpen } from '@/lib/context-menu-overlay'

interface WorkspaceTabItemProps {
  tab: AppTab
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

export function WorkspaceTabItem({
  tab,
  collapsed = false,
  iconOnly = false,
  isActive,
}: WorkspaceTabItemProps) {
  const { t } = useTranslation()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  const session = useWorkspaceSession(tab.id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')
  const uiStyle = useUiStyle()

  const compact = collapsed || iconOnly
  const displayTitle = tab.customTitle || tab.title
  const showActiveIcon = session.isStarted && tab.workspaceDir

  const requestClose = () => {
    if (session.isStarted) {
      scheduleOverlayOpen(() => setConfirmOpen(true))
      return
    }
    void closeWorkspaceTab(tab.id)
  }

  const openEditDialog = () => {
    scheduleOverlayOpen(() => {
      setEditValue(tab.customTitle ?? tab.title)
      setEditOpen(true)
    })
  }

  const saveEditTitle = () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === tab.title) {
      setTabCustomTitle(tab.id, undefined)
    } else {
      setTabCustomTitle(tab.id, trimmed)
    }
    setEditOpen(false)
  }

  const TabIcon = showActiveIcon ? Sparkle : Computer

  const row = (
    <div
      title={displayTitle}
      className={cn(
        'group flex cursor-pointer items-center transition-colors',
        iconOnly
          ? cn('size-6 shrink-0 justify-center', getTabCornerRadius(uiStyle))
          : cn(getTabCornerRadius(uiStyle), 'py-1.5', compact ? 'justify-center px-0' : 'gap-2 px-2'),
        getTabHighlightClasses(isActive, iconOnly, uiStyle),
        showActiveIcon && isActive && 'text-primary',
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <TabIcon
        className={cn(
          'shrink-0',
          iconOnly ? 'size-3' : 'size-4',
          showActiveIcon && 'text-primary',
        )}
      />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{displayTitle}</span>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            aria-label={t('tab.closeAria', { title: displayTitle })}
            onClick={(e) => {
              e.stopPropagation()
              requestClose()
            }}
          >
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
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
          <ContextMenuItem onSelect={() => requestClose()}>
            <X className="size-4 text-muted-foreground" />
            {t('common.close')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={openEditDialog}>
            <Pencil className="size-4 text-muted-foreground" />
            {t('tab.editTitle')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {confirmOpen ? (
        <AlertDialog open onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('workspace.closeConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('workspace.closeConfirmDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false)
                  void closeWorkspaceTab(tab.id)
                }}
              >
                {t('common.close')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {editOpen ? (
        <Dialog open onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tab.editTitle')}</DialogTitle>
              <DialogDescription>
                {t('tab.editTitleDesc', { defaultTitle: tab.title })}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.currentTarget.value)}
              placeholder={tab.title}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEditTitle()
              }}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={saveEditTitle}>{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
