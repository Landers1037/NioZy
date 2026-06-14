import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftRight,
  Columns2,
  Copy,
  Download,
  FolderOpen,
  PackagePlus,
  ListX,
  Pencil,
  Shield,
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
import { getTabCornerRadius, useUiStyle } from '@/lib/ui-style'
import {
  closeOtherTerminalTabs,
  closeTerminalTabs,
  exportTerminalTab,
} from '@/lib/tab-actions'
import { openScpTransferForTab } from '@/lib/scp-transfer-actions'
import { isSshTerminalTab } from '@/lib/ssh-connection'
import { getElectronAPI } from '@/lib/electron-client'
import {
  getAllTerminalIds,
  getSplitPanes,
  MAX_TERMINAL_SPLITS,
} from '@/lib/terminal-tab-utils'
import { splitTerminalTab } from '@/lib/terminal-split-actions'
import {
  canShowRestartAsAdminMenu,
  restartTerminalTabAsAdmin,
} from '@/lib/terminal-restart-actions'
import { cloneTerminalTab } from '@/lib/terminal-clone-actions'
import {
  changeTerminalTabDirectory,
  getDroppedFilePaths,
  hasExternalFileDrag,
} from '@/lib/terminal-drop-actions'
import { AddToGroupDialog } from '@/components/layout/AddToGroupDialog'
import { findGroupForTab } from '@/lib/tab-groups'
import { useTabGroupStore } from '@/stores/tab-group-store'

interface TerminalTabItemProps {
  tab: AppTab
  /** 侧栏收起时仅显示图标 */
  collapsed?: boolean
  /** 极简模式横向 Tab：仅图标、紧凑尺寸 */
  iconOnly?: boolean
  isActive: boolean
  /** 终端 Tab 在侧栏中的序号（从 1 开始） */
  terminalIndex?: number
  /** 是否在名称左侧显示序号 */
  showTerminalIndex?: boolean
  /** 是否处于拖拽模式 */
  isDragging?: boolean
  /** 侧栏是否有 Tab 正在拖拽 */
  dragModeActive?: boolean
  /** 是否启用长按拖拽 */
  dragEnabled?: boolean
  onDragPointerDown?: (tabId: string, e: React.PointerEvent) => void
  onDragPointerMove?: (e: React.PointerEvent) => void
  onDragPointerUp?: (e: React.PointerEvent) => void
  onDragPointerCancel?: (e: React.PointerEvent) => void
  shouldSuppressClick?: () => boolean
}

function terminalTabItemPropsEqual(
  prev: TerminalTabItemProps,
  next: TerminalTabItemProps,
): boolean {
  if (prev.isActive !== next.isActive) return false
  if (prev.collapsed !== next.collapsed) return false
  if (prev.iconOnly !== next.iconOnly) return false
  if (prev.terminalIndex !== next.terminalIndex) return false
  if (prev.showTerminalIndex !== next.showTerminalIndex) return false
  if (prev.isDragging !== next.isDragging) return false
  if (prev.dragModeActive !== next.dragModeActive) return false
  if (prev.dragEnabled !== next.dragEnabled) return false
  if (prev.onDragPointerDown !== next.onDragPointerDown) return false
  if (prev.onDragPointerMove !== next.onDragPointerMove) return false
  if (prev.onDragPointerUp !== next.onDragPointerUp) return false
  if (prev.onDragPointerCancel !== next.onDragPointerCancel) return false
  if (prev.shouldSuppressClick !== next.shouldSuppressClick) return false
  return prev.tab === next.tab
}

export const TerminalTabItem = memo(function TerminalTabItem({
  tab,
  collapsed = false,
  iconOnly = false,
  isActive,
  terminalIndex,
  showTerminalIndex = false,
  isDragging = false,
  dragModeActive = false,
  dragEnabled = false,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  shouldSuppressClick,
}: TerminalTabItemProps) {
  const { t } = useTranslation()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)

  const groups = useTabGroupStore((s) => s.groups)
  const existingGroup = findGroupForTab(groups, tab.id)

  const [closeOpen, setCloseOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [appElevated, setAppElevated] = useState(false)
  const [fileDragOver, setFileDragOver] = useState(false)

  useEffect(() => {
    if (getElectronAPI().system.platform !== 'win32') return
    void getElectronAPI().system.isProcessElevated().then(setAppElevated)
  }, [])

  const showRestartAsAdmin = canShowRestartAsAdminMenu(tab, appElevated)

  const uiStyle = useUiStyle()
  const displayTitle = getTabDisplayTitle(tab)

  const handleQuickClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    for (const terminalId of getAllTerminalIds(tab)) {
      getElectronAPI().terminal.kill(terminalId)
    }
    removeTab(tab.id)
  }

  const splitCount = getSplitPanes(tab).length
  const canSplit = splitCount < MAX_TERMINAL_SPLITS

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

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      onDragPointerDown?.(tab.id, e)
    },
    [onDragPointerDown, tab.id],
  )

  const handleFileDragEnter = (e: React.DragEvent) => {
    if (!hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    setFileDragOver(true)
  }

  const handleFileDragOver = (e: React.DragEvent) => {
    if (!hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setFileDragOver(true)
  }

  const handleFileDragLeave = (e: React.DragEvent) => {
    if (!hasExternalFileDrag(e.dataTransfer)) return
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setFileDragOver(false)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    if (!hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    setFileDragOver(false)
    const paths = getDroppedFilePaths(e.dataTransfer)
    if (paths.length === 0) return
    void changeTerminalTabDirectory(tab, paths[0])
  }

  const row = (
    <div
      title={displayTitle}
      className={cn(
        'group flex cursor-pointer items-center transition-colors touch-none',
        iconOnly
          ? cn('size-6 shrink-0 justify-center', getTabCornerRadius(uiStyle))
          : cn(getTabCornerRadius(uiStyle), 'py-1.5', compact ? 'justify-center px-0' : 'gap-2 px-2'),
        getTabHighlightClasses(isActive, iconOnly, uiStyle),
        isDragging && 'z-20 scale-[1.02] shadow-md ring-2 ring-primary/60',
        dragModeActive && !isDragging && 'opacity-60',
        fileDragOver && 'bg-primary/15 ring-2 ring-primary/50',
      )}
      onClick={() => {
        if (shouldSuppressClick?.()) return
        setActiveTab(tab.id)
      }}
      onDragEnter={handleFileDragEnter}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
      onPointerDown={dragEnabled ? handleDragPointerDown : undefined}
      onPointerMove={dragEnabled ? onDragPointerMove : undefined}
      onPointerUp={dragEnabled ? onDragPointerUp : undefined}
      onPointerCancel={dragEnabled ? onDragPointerCancel : undefined}
    >
      <Terminal className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!compact && (
        <>
          {showTerminalIndex && terminalIndex != null ? (
            <span
              className={cn(
                'inline-flex size-5 shrink-0 items-center justify-center rounded border text-[10px] font-medium tabular-nums leading-none',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-muted/40 text-muted-foreground',
              )}
            >
              {terminalIndex}
            </span>
          ) : null}
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
          <ContextMenuItem onSelect={() => void cloneTerminalTab(tab.id)}>
            <Copy className="size-4 text-muted-foreground" />
            {t('tab.cloneTerminal')}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canSplit}
            onSelect={() => {
              if (!isActive) setActiveTab(tab.id)
              void splitTerminalTab(tab.id)
            }}
          >
            <Columns2 className="size-4 text-muted-foreground" />
            {t('tab.splitTerminal')}
          </ContextMenuItem>
          {isSshTerminalTab(tab) ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => openScpTransferForTab(tab.id)}>
                <ArrowLeftRight className="size-4 text-muted-foreground" />
                {t('tab.openScpTransfer')}
              </ContextMenuItem>
            </>
          ) : null}
          {showRestartAsAdmin ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => {
                  if (!isActive) setActiveTab(tab.id)
                  void restartTerminalTabAsAdmin(tab.id)
                }}
              >
                <Shield className="size-4 text-muted-foreground" />
                {t('tab.restartAsAdmin')}
              </ContextMenuItem>
            </>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setAddToGroupOpen(true)}>
            <PackagePlus className="size-4 text-muted-foreground" />
            {existingGroup ? t('tab.moveToGroup') : t('tab.addToGroup')}
          </ContextMenuItem>
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

      <AddToGroupDialog
        tabId={tab.id}
        open={addToGroupOpen}
        onOpenChange={setAddToGroupOpen}
      />

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
}, terminalTabItemPropsEqual)

TerminalTabItem.displayName = 'TerminalTabItem'
