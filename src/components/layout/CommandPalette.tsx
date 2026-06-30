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
  getCommandPaletteGroupLabel,
  isShowAllCommandsQuery,
  listCommandPaletteItems,
  type CommandPaletteCommandId,
  type CommandPaletteListItem,
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
  const settingsUiStyle = settings?.uiStyle
  const settingsTheme = settings?.theme

  const commandItems = useMemo(
    () => listCommandPaletteItems(query),
    [query, open, activeTab?.id, tabs, groups, terminalRenderer, settings?.experimental.terminalEmulator],
  )
  const pickerItems = useMemo(
    () => (subPanel ? listPickerItems(subPanel, query) : []),
    [subPanel, query, terminalRenderer, terminalColorScheme, settingsUiStyle, settingsTheme],
  )
  const showAllCommands = !subPanel && isShowAllCommandsQuery(query)
  const groupedCommandItems = useMemo(() => {
    if (!showAllCommands) return []
    const groups: Array<{ label: string; items: CommandPaletteListItem[] }> = []
    for (const item of commandItems) {
      const label = getCommandPaletteGroupLabel(item.command.group)
      const last = groups[groups.length - 1]
      if (last?.label === label) {
        last.items.push(item)
      } else {
        groups.push({ label, items: [item] })
      }
    }
    return groups
  }, [commandItems, showAllCommands])
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
  }, [open, subPanel, resetState])

  useEffect(() => {
    if (inSubPanel) {
      const items = listPickerItems(subPanel!, query)
      setSelectedIndex(query.trim() ? 0 : getActivePickerIndex(items))
      return
    }
    setSelectedIndex(0)
  }, [query, subPanel, inSubPanel, terminalRenderer, terminalColorScheme, settingsUiStyle, settingsTheme])

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

      if (result.type === 'dismissed') {
        closePalette()
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

  const handlePaletteNavigationKey = useCallback(
    (e: Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation' | 'stopImmediatePropagation'>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, listCount - 1)))
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return true
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        if (inSubPanel) {
          const item = pickerItems[selectedIndex]
          if (item) runPickerSelection(item.id)
          return true
        }
        const item = commandItems[selectedIndex]
        if (item) void runCommand(item.command.id, item.enabled)
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        if (inSubPanel) {
          exitSubPanel()
          return true
        }
        closePalette()
        return true
      }
      return false
    },
    [
      listCount,
      inSubPanel,
      pickerItems,
      selectedIndex,
      commandItems,
      runPickerSelection,
      runCommand,
      exitSubPanel,
      closePalette,
    ],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      handlePaletteNavigationKey(e)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, handlePaletteNavigationKey])

  const handleKeyDown = (
    e: Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation' | 'stopImmediatePropagation'>,
  ) => {
    handlePaletteNavigationKey(e)
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
                onChange={(e) => setQuery(e.currentTarget.value)}
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
              ) : showAllCommands ? (
                groupedCommandItems.map((group) => (
                  <div key={group.label} className="pb-1">
                    <div className="px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const index = commandItems.findIndex((entry) => entry.command.id === item.command.id)
                      const Icon = item.command.icon
                      const selected = index === selectedIndex
                      const badge = item.command.leadingBadge?.()
                      const trailingHint = item.command.trailingHint?.()
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
                          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                            {badge ? (
                              <span
                                className={cn(
                                  'max-w-[40%] shrink truncate rounded-md border border-border/60 bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground',
                                  selected &&
                                    item.enabled &&
                                    'border-accent-foreground/20 bg-accent-foreground/10 text-accent-foreground/80',
                                )}
                                title={badge}
                              >
                                {badge}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{item.command.label()}</span>
                          </div>
                          {!item.enabled ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {t('commandPalette.unavailableShort')}
                            </span>
                          ) : trailingHint ? (
                            <span
                              className={cn(
                                'shrink-0 text-xs text-muted-foreground',
                                selected && item.enabled && 'text-accent-foreground/75',
                              )}
                            >
                              {trailingHint}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))
              ) : (
                commandItems.map((item, index) => {
                  const Icon = item.command.icon
                  const selected = index === selectedIndex
                  const groupLabel = getCommandPaletteGroupLabel(item.command.group)
                  const badge = item.command.leadingBadge?.()
                  const trailingHint = item.command.trailingHint?.()
                  const showGroupInline = !showAllCommands
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
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        {badge ? (
                          <span
                            className={cn(
                              'max-w-[40%] shrink truncate rounded-md border border-border/60 bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground',
                              selected && item.enabled && 'border-accent-foreground/20 bg-accent-foreground/10 text-accent-foreground/80',
                            )}
                            title={badge}
                          >
                            {badge}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.command.label()}</span>
                        {showGroupInline ? (
                          <span
                            className={cn(
                              'shrink-0 text-[11px] uppercase tracking-[0.08em] text-muted-foreground',
                              selected && item.enabled && 'text-accent-foreground/75',
                            )}
                          >
                            {groupLabel}
                          </span>
                        ) : null}
                      </div>
                      {!item.enabled ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('commandPalette.unavailableShort')}
                        </span>
                      ) : trailingHint ? (
                        <span
                          className={cn(
                            'shrink-0 text-xs text-muted-foreground',
                            selected && item.enabled && 'text-accent-foreground/75',
                          )}
                        >
                          {trailingHint}
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
          {closeOpen ? (
            <AlertDialog open onOpenChange={setCloseOpen}>
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
          ) : null}

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

          {editOpen ? (
            <Dialog open onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('tab.editTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('tab.editTitleDesc', { defaultTitle: activeTab.title })}
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.currentTarget.value)}
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
          ) : null}
        </>
      ) : null}
    </>
  )
}
