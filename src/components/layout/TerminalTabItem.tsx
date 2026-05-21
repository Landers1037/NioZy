import { useState } from 'react'
import { Terminal, X } from 'lucide-react'
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
import { getTabDisplayTitle } from '@/lib/tab-display'
import {
  closeOtherTerminalTabs,
  closeTerminalTabs,
  exportTerminalTab,
} from '@/lib/tab-actions'
import { getElectronAPI } from '@/lib/electron-client'

interface TerminalTabItemProps {
  tab: AppTab
  collapsed: boolean
  isActive: boolean
}

export function TerminalTabItem({ tab, collapsed, isActive }: TerminalTabItemProps) {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)

  const [closeOpen, setCloseOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState('')

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

  const row = (
    <div
      title={displayTitle}
      className={cn(
        'group flex cursor-pointer items-center rounded-[10px] py-1.5 transition-colors',
        collapsed ? 'justify-center px-0' : 'gap-2 px-2',
        isActive
          ? 'bg-card text-foreground shadow-sm dark:bg-primary/18 dark:text-foreground dark:shadow-none dark:ring-1 dark:ring-primary/35 dark:font-medium'
          : 'text-muted-foreground hover:bg-card/60 dark:hover:bg-primary/10',
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <Terminal className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm" title={displayTitle}>
            {displayTitle}
          </span>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            aria-label={`关闭 ${displayTitle}`}
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
            打开
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setCloseOpen(true)}>关闭</ContextMenuItem>
          <ContextMenuItem onSelect={() => closeOtherTerminalTabs(tab.id)}>关闭其他</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={openEditDialog}>编辑标题</ContextMenuItem>
          <ContextMenuItem onSelect={() => void exportTerminalTab(tab.id)}>导出终端</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>关闭终端</AlertDialogTitle>
            <AlertDialogDescription>
              确定要关闭「{displayTitle}」吗？终端进程将结束，未导出的内容将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:opacity-90"
              onClick={() => closeTerminalTabs([tab.id])}
            >
              关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标题</DialogTitle>
            <DialogDescription>
              自定义侧边栏与状态栏中的展示名称。留空或恢复为默认名称时将使用「{tab.title}」。
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
              取消
            </Button>
            <Button onClick={saveEditTitle}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
