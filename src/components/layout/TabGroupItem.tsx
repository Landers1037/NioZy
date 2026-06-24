import { useState } from 'react'
import { Package, PackageOpen, PackageX, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getTabCornerRadius, useUiStyle } from '@/lib/ui-style'
import { getTabHighlightClasses } from '@/lib/tab-display'
import type { TabGroup } from '@/lib/tab-groups'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { closeTabGroup } from '@/lib/tab-group-actions'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
import { scheduleOverlayOpen } from '@/lib/context-menu-overlay'

interface TabGroupItemProps {
  group: TabGroup
  collapsed?: boolean
  iconOnly?: boolean
  isActive: boolean
}

export function TabGroupItem({
  group,
  collapsed = false,
  iconOnly = false,
  isActive,
}: TabGroupItemProps) {
  const { t } = useTranslation()
  const enterGroup = useTabGroupStore((s) => s.enterGroup)
  const renameGroup = useTabGroupStore((s) => s.renameGroup)
  const uiStyle = useUiStyle()
  const compact = collapsed || iconOnly

  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [closeOpen, setCloseOpen] = useState(false)

  const openEditDialog = () => {
    scheduleOverlayOpen(() => {
      setEditValue(group.name)
      setEditOpen(true)
    })
  }

  const saveEditName = () => {
    const trimmed = editValue.trim()
    if (trimmed) {
      renameGroup(group.id, trimmed)
    }
    setEditOpen(false)
  }

  const row = (
    <div
      title={group.name}
      className={cn(
        'group flex cursor-pointer items-center transition-colors',
        iconOnly
          ? cn('size-6 shrink-0 justify-center', getTabCornerRadius(uiStyle))
          : cn(getTabCornerRadius(uiStyle), 'py-1.5', compact ? 'justify-center px-0' : 'gap-2 px-2'),
        getTabHighlightClasses(isActive, iconOnly, uiStyle),
      )}
      onClick={() => enterGroup(group.id)}
    >
      <Package className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!compact && (
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={group.name}>
          {group.name}
        </span>
      )}
      {!compact && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {t('tab.groupTabCount', { count: group.tabIds.length })}
        </span>
      )}
    </div>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => enterGroup(group.id)}>
            <PackageOpen className="size-4 text-muted-foreground" />
            {t('tab.enterGroup')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={openEditDialog}>
            <Pencil className="size-4 text-muted-foreground" />
            {t('tab.editGroupName')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => scheduleOverlayOpen(() => setCloseOpen(true))}>
            <PackageX className="size-4 text-muted-foreground" />
            {t('tab.closeGroup')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {closeOpen ? (
        <AlertDialog open onOpenChange={setCloseOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tab.closeGroupTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('tab.closeGroupDesc', {
                  name: group.name,
                  count: group.tabIds.length,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:opacity-90"
                onClick={() => closeTabGroup(group.id)}
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
              <DialogTitle>{t('tab.editGroupName')}</DialogTitle>
              <DialogDescription>{t('tab.editGroupNameDesc')}</DialogDescription>
            </DialogHeader>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={group.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEditName()
              }}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!editValue.trim()} onClick={saveEditName}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
