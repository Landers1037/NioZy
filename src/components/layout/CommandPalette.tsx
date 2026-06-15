import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTabCornerRadius, useUiStyle } from '@/lib/ui-style'
import {
  dialogContentClass,
  dialogOverlayClass,
  UI_DIALOG_OVERLAY,
  useDialogAnimationEnabled,
} from '@/lib/dialog-animations'
import { Input } from '@/components/ui/input'
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
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { AddToGroupDialog } from '@/components/layout/AddToGroupDialog'
import { TerminalScreenshotDialog } from '@/components/layout/TerminalScreenshotDialog'
import {
  resolveTerminalTabForCommand,
  confirmCloseActiveTerminalTab,
  executeCommandPaletteCommand,
  isShowAllCommandsQuery,
  listCommandPaletteItems,
  type CommandPaletteCommandId,
} from '@/lib/command-palette-commands'
import {
  applyPickerSelection,
  getActivePickerIndex,
  getSubPanelTitle,
  listPickerItems,
  type CommandPaletteSubPanelKind,
} from '@/lib/command-palette-pickers'
import { useTabGroupStore } from '@/stores/tab-group-store'
import {
  recordCommandUsage,
  useCommandPaletteStore,
} from '@/stores/command-palette-store'

export function CommandPalette() {
  const { t } = useTranslation()
  const open = useCommandPaletteStore((s) => s.open)
  const closePalette = useCommandPaletteStore((s) => s.closePalette)
  const uiStyle = useUiStyle()
  const animate = useDialogAnimationEnabled()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [subPanel, setSubPanel] = useState<CommandPaletteSubPanelKind | null>(null)
  const [subPanelParentId, setSubPanelParentId] = useState<CommandPaletteCommandId | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(false)
  const [editValue, setEditValue] = useState('')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const activeTab = useAppStore((s) => {
    const tab = s.tabs.find((x) => x.id === s.activeTabId)
    return tab?.type === 'terminal' ? tab : undefined
  })
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)

  const groups = useTabGroupStore((s) => s.groups)
  const settings = useAppStore((s) => s.settings)
  const tabs = useAppStore((s) => s.tabs)
  const terminalRenderer = settings?.terminal.renderer
  const terminalColorScheme = settings?.terminal.colorScheme

  const commandItems = useMemo(
    () => listCommandPaletteItems(query),
    [query, open, activeTab?.id, tabs, groups, terminalRenderer, settings?.experimental.terminalEmulator],
  )
  const pickerItems = useMemo(
    () => (subPanel ? listPickerItems(subPanel, query) : []),
    [subPanel, query, terminalRenderer, terminalColorScheme],
  )
  const showAllCommands = !subPanel && isShowAllCommandsQuery(query)
  const inSubPanel = subPanel != null
  const listCount = inSubPanel ? pickerItems.length : commandItems.length

  const resetState = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
    setSubPanel(null)
    setSubPanelParentId(null)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, resetState])

  useEffect(() => {
    if (inSubPanel) {
      const items = listPickerItems(subPanel!, query)
      setSelectedIndex(query.trim() ? 0 : getActivePickerIndex(items))
      return
    }
    setSelectedIndex(0)
  }, [query, subPanel, inSubPanel, terminalRenderer, terminalColorScheme])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedIndex, listCount])

  const exitSubPanel = useCallback(() => {
    setSubPanel(null)
    setSubPanelParentId(null)
    setQuery('')
    setSelectedIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const runPickerSelection = useCallback(
    (itemId: string) => {
      if (!subPanel) return
      applyPickerSelection(subPanel, itemId)
      if (subPanelParentId) recordCommandUsage(subPanelParentId)
      closePalette()
    },
    [subPanel, subPanelParentId, closePalette],
  )

  const runCommand = useCallback(
    async (id: CommandPaletteCommandId, enabled: boolean) => {
      if (!enabled) {
        toast.message(t('commandPalette.unavailable'))
        return
      }

      const result = await executeCommandPaletteCommand(id)
      if (result.type === 'unavailable') {
        toast.message(t('commandPalette.unavailable'))
        return
      }

      if (result.type === 'subPanel') {
        setSubPanel(result.panel)
        setSubPanelParentId(id)
        setQuery('')
        return
      }

      recordCommandUsage(id)

      if (result.type === 'dialog') {
        closePalette()
        const tab = resolveTerminalTabForCommand()
        if (!tab) {
          toast.message(t('commandPalette.unavailable'))
          return
        }
        switch (result.dialog) {
          case 'editTitle':
            setEditValue(tab.customTitle ?? tab.title)
            setEditOpen(true)
            break
          case 'closeConfirm':
            setCloseOpen(true)
            break
          case 'addToGroup':
            setAddToGroupOpen(true)
            break
          case 'screenshot':
            setScreenshotOpen(true)
            break
        }
        return
      }

      closePalette()
    },
    [closePalette, t],
  )

  const saveEditTitle = () => {
    if (!activeTab) return
    const trimmed = editValue.trim()
    if (!trimmed) setTabCustomTitle(activeTab.id, undefined)
    else if (trimmed !== activeTab.title) setTabCustomTitle(activeTab.id, trimmed)
    else setTabCustomTitle(activeTab.id, undefined)
    setEditOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, listCount - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inSubPanel) {
        const item = pickerItems[selectedIndex]
        if (item) runPickerSelection(item.id)
        return
      }
      const item = commandItems[selectedIndex]
      if (item) void runCommand(item.command.id, item.enabled)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (inSubPanel) {
        exitSubPanel()
        return
      }
      closePalette()
    }
  }

  if (!open && !editOpen && !closeOpen && !addToGroupOpen && !screenshotOpen) {
    return null
  }

  const displayTitle = activeTab ? getTabDisplayTitle(activeTab) : ''
  const inputPlaceholder = inSubPanel
    ? t(`commandPalette.subPanel.${subPanel}Placeholder`)
    : t('commandPalette.placeholder')

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[60] no-drag">
          <button
            type="button"
            className={cn('absolute inset-0', UI_DIALOG_OVERLAY, dialogOverlayClass(animate))}
            aria-label={t('common.close')}
            onClick={() => closePalette()}
          />
          <div
            className={cn(
              'ui-overlay-panel pointer-events-auto absolute left-1/2 top-[12%] w-full max-w-xl -translate-x-1/2 overflow-hidden border border-border bg-card shadow-lg',
              getTabCornerRadius(uiStyle),
              dialogContentClass(animate),
            )}
            role="dialog"
            aria-modal="true"
            aria-label={inSubPanel ? getSubPanelTitle(subPanel!) : t('commandPalette.title')}
          >
            {inSubPanel ? (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <button
                  type="button"
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  onClick={exitSubPanel}
                >
                  <ChevronLeft className="size-3.5" />
                  {t('commandPalette.subPanelBack')}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {getSubPanelTitle(subPanel!)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={inputPlaceholder}
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onKeyDown={handleKeyDown}
              />
            </div>
            <div
              ref={listRef}
              className={cn('overflow-y-auto p-1', inSubPanel || showAllCommands ? 'max-h-80' : 'max-h-72')}
            >
              {listCount === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('commandPalette.noResults')}
                </div>
              ) : inSubPanel ? (
                pickerItems.map((item, index) => {
                  const selected = index === selectedIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-cmd-index={index}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        getTabCornerRadius(uiStyle),
                        selected
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-muted/60',
                      )}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => runPickerSelection(item.id)}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {item.active ? <Check className="size-4 text-primary" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  )
                })
              ) : (
                commandItems.map((item, index) => {
                  const Icon = item.command.icon
                  const selected = index === selectedIndex
                  return (
                    <button
                      key={item.command.id}
                      type="button"
                      data-cmd-index={index}
                      disabled={!item.enabled}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        getTabCornerRadius(uiStyle),
                        !item.enabled && 'cursor-not-allowed opacity-45',
                        item.enabled && 'cursor-pointer',
                        selected && item.enabled
                          ? 'bg-accent text-accent-foreground'
                          : item.enabled
                            ? 'text-foreground hover:bg-muted/60'
                            : 'text-muted-foreground',
                      )}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => void runCommand(item.command.id, item.enabled)}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{item.command.label()}</span>
                      {!item.enabled ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('commandPalette.unavailableShort')}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
            {inSubPanel ? (
              <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                {t('commandPalette.subPanelHint')}
              </div>
            ) : !query.trim() && commandItems.length > 0 ? (
              <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                {t('commandPalette.recentHint')} · {t('commandPalette.helpTip')}
              </div>
            ) : showAllCommands && commandItems.length > 0 ? (
              <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                {t('commandPalette.allCommandsHint')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab ? (
        <>
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
                  onClick={() => confirmCloseActiveTerminalTab()}
                >
                  {t('common.close')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AddToGroupDialog
            tabId={activeTab.id}
            open={addToGroupOpen}
            onOpenChange={setAddToGroupOpen}
          />

          <TerminalScreenshotDialog
            tabId={activeTab.id}
            open={screenshotOpen}
            onOpenChange={setScreenshotOpen}
          />

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('tab.editTitle')}</DialogTitle>
                <DialogDescription>
                  {t('tab.editTitleDesc', { defaultTitle: activeTab.title })}
                </DialogDescription>
              </DialogHeader>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={activeTab.title}
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
      ) : null}
    </>
  )
}
