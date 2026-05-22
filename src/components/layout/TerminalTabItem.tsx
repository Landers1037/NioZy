import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  FolderOpen,
  ListX,
  Pencil,
  Terminal,
  X,
} from 'lucide-react'
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
import { useAppStore, type AppTab } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { getTabDisplayTitle, getTabHighlightClasses } from '@/lib/tab-display'
import { useUiStyle } from '@/lib/ui-style'
import {
  closeOtherTerminalTabs,
  closeTerminalTabs,
  exportTerminalTab,
} from '@/lib/tab-actions'
import { getElectronAPI } from '@/lib/electron-client'

interface TerminalTabItemProps {
  tab: AppTab
  /** 侧栏收起时仅显示图标 */
  collapsed?: boolean
  /** 极简模式横向 Tab：仅图标、紧凑尺寸 */
  iconOnly?: boolean
  isActive: boolean
}

export function TerminalTabItem({
  tab,
  collapsed = false,
  iconOnly = false,
  isActive,
}: TerminalTabItemProps) {
  const { t } = useTranslation()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)

  const [closeOpen, setCloseOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')

  const uiStyle = useUiStyle()
  const displayTitle = getTabDisplayTitle(tab)

  const handleQuickClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tab.terminalId) getElectronAPI().terminal.kill(tab.terminalId)
    removeTab(tab.id)
  }

  const openEditDialog = () => {
    setEditValue(tab.customTitle ?? tab.title)
    setEditOpen(true)
  }

  const saveEditTitle = () => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setTabCustomTitle(tab.id, undefined)
    } else if (trimmed !== tab.title) {
      setTabCustomTitle(tab.id, trimmed)
    } else {
      setTabCustomTitle(tab.id, undefined)
    }
    setEditOpen(false)
  }

  const compact = collapsed || iconOnly

  const row = (
    <div
      title={displayTitle}
      className={cn(
        'group flex cursor-pointer items-center transition-colors',
        iconOnly
          ? 'size-6 shrink-0 justify-center rounded-md'
          : cn(
              uiStyle === 'niozy' ? 'rounded-[10px]' : 'rounded-lg',
              'py-1.5',
              compact ? 'justify-center px-0' : 'gap-2 px-2',
            ),
        getTabHighlightClasses(isActive, iconOnly, uiStyle),
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <Terminal className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm" title={displayTitle}>
            {displayTitle}
          </span>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            aria-label={t('tab.closeAria', { title: displayTitle })}
            onClick={handleQuickClose}
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
          <ContextMenuItem onSelect={() => setCloseOpen(true)}>
            <X className="size-4 text-muted-foreground" />
            {t('common.close')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => closeOtherTerminalTabs(tab.id)}>
            <ListX className="size-4 text-muted-foreground" />
            {t('tab.closeOther')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={openEditDialog}>
            <Pencil className="size-4 text-muted-foreground" />
            {t('tab.editTitle')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void exportTerminalTab(tab.id)}>
            <Download className="size-4 text-muted-foreground" />
            {t('tab.exportTerminal')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tab.closeTerminalTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tab.closeTerminalDesc', { title: displayTitle })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:opacity-90"
              onClick={() => closeTerminalTabs([tab.id])}
            >
              {t('common.close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tab.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('tab.editTitleDesc', { defaultTitle: tab.title })}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
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
    </>
  )
}
