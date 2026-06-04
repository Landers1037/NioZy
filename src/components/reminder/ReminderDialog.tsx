import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Repeat2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  isReminderCompleted,
  isReminderRepeating,
  isReminderUntriggered,
  type ReminderItem,
  type ReminderRepeat,
} from '../../../electron/shared/reminder-data'
import type { ReminderLevel } from '../../../electron/shared/reminder-settings'
import { ReminderLevelTag } from '@/lib/reminder-level-tag'
import {
  combineRemindAt,
  formatReminderDateTime,
  REMINDER_LEVELS,
  splitRemindAt,
} from '@/lib/reminder-utils'
import { useReminderStore } from '@/stores/reminder-store'
import { cn } from '@/lib/utils'

type ViewMode = 'list' | 'detail' | 'create'

type RepeatInterval = Exclude<ReminderRepeat, 'none'>

function createEmptyDraft(): {
  title: string
  content: string
  level: ReminderLevel
  date: string
  time: string
  repeatEnabled: boolean
  repeatInterval: RepeatInterval
} {
  const { date, time } = splitRemindAt(new Date().toISOString())
  return {
    title: '',
    content: '',
    level: 'normal',
    date,
    time,
    repeatEnabled: false,
    repeatInterval: 'daily',
  }
}

export function ReminderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const items = useReminderStore((s) => s.items)
  const loading = useReminderStore((s) => s.loading)
  const load = useReminderStore((s) => s.load)
  const saveItem = useReminderStore((s) => s.saveItem)
  const deleteItem = useReminderStore((s) => s.deleteItem)
  const clearCompleted = useReminderStore((s) => s.clearCompleted)

  const [view, setView] = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState(createEmptyDraft)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)
  const [clearingCompleted, setClearingCompleted] = useState(false)

  useEffect(() => {
    if (open) {
      void load()
      setView('list')
      setSelectedId(null)
      setShowIncompleteOnly(false)
    }
  }, [open, load])

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    [items],
  )

  const displayItems = useMemo(
    () =>
      showIncompleteOnly
        ? sortedItems.filter((item) => isReminderUntriggered(item))
        : sortedItems,
    [sortedItems, showIncompleteOnly],
  )

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null

  const openCreate = () => {
    setDraft(createEmptyDraft())
    setSelectedId(null)
    setView('create')
  }

  const openDetail = (item: ReminderItem) => {
    const parts = splitRemindAt(item.remindAt)
    setSelectedId(item.id)
    setDraft({
      title: item.title,
      content: item.content,
      level: item.level,
      date: parts.date,
      time: parts.time,
      repeatEnabled: isReminderRepeating(item),
      repeatInterval:
        item.repeat === 'weekly' || item.repeat === 'monthly' ? item.repeat : 'daily',
    })
    setView('detail')
  }

  const handleSave = async () => {
    if (!draft.title.trim()) {
      toast.error(t('reminder.validation.titleRequired'))
      return
    }
    setSaving(true)
    try {
      await saveItem({
        id: view === 'detail' && selectedId ? selectedId : crypto.randomUUID(),
        title: draft.title.trim(),
        content: draft.content,
        level: draft.level,
        remindAt: combineRemindAt(draft.date, draft.time),
        createdAt: selectedItem?.createdAt ?? new Date().toISOString(),
        dismissed: false,
        repeat: draft.repeatEnabled ? draft.repeatInterval : 'none',
        occurrenceDoneAt: selectedItem?.occurrenceDoneAt ?? null,
      })
      toast.success(t('reminder.saved'))
      setView('list')
      setSelectedId(null)
    } catch {
      toast.error(t('reminder.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await deleteItem(selectedId)
      toast.success(t('reminder.deleted'))
      setDeleteOpen(false)
      setView('list')
      setSelectedId(null)
    } catch {
      toast.error(t('reminder.deleteFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleClearCompleted = async () => {
    setClearingCompleted(true)
    try {
      const removed = await clearCompleted()
      if (removed === 0) {
        toast.info(t('reminder.noCompleted'))
        return
      }
      toast.success(t('reminder.clearedCompleted', { count: removed }))
    } catch {
      toast.error(t('reminder.clearCompletedFailed'))
    } finally {
      setClearingCompleted(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {view === 'list'
                ? t('reminder.dialogTitle')
                : view === 'create'
                  ? t('reminder.addTitle')
                  : t('reminder.detailTitle')}
            </DialogTitle>
          </DialogHeader>

          {view === 'list' ? (
            <div className="flex flex-col gap-3">
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                {loading ? (
                  <p className="p-4 text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : displayItems.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    {showIncompleteOnly ? t('reminder.emptyIncomplete') : t('reminder.empty')}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {displayItems.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                          onClick={() => openDetail(item)}
                        >
                          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <ReminderLevelTag level={item.level} t={t} />
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate text-sm font-medium',
                                  isReminderCompleted(item) && 'text-muted-foreground',
                                )}
                              >
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs leading-none text-muted-foreground">
                              <span className="tabular-nums">{formatReminderDateTime(item.remindAt)}</span>
                              {isReminderRepeating(item) ? (
                                <Repeat2
                                  className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                                  aria-label={t('reminder.repeatBadge')}
                                  title={t(`reminder.repeat.${item.repeat}`)}
                                />
                              ) : null}
                            </div>
                          </div>
                          {isReminderCompleted(item) ? (
                            <span
                              aria-label={t('reminder.completedBadge')}
                              title={t('reminder.completedBadge')}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15"
                            >
                              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="w-fit" onClick={openCreate}>
                  <Plus className="size-4" />
                  {t('reminder.add')}
                </Button>
                <Button
                  variant={showIncompleteOnly ? 'default' : 'outline'}
                  className="w-fit"
                  onClick={() => setShowIncompleteOnly((value) => !value)}
                >
                  {t('reminder.showIncomplete')}
                </Button>
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={clearingCompleted}
                  onClick={() => void handleClearCompleted()}
                >
                  {t('reminder.clearCompleted')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-fit px-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setView('list')
                  setSelectedId(null)
                }}
              >
                <ArrowLeft className="size-4" />
                {t('reminder.backToList')}
              </Button>

              <div className="grid gap-2">
                <Label htmlFor="reminder-title">{t('reminder.fieldTitle')}</Label>
                <Input
                  id="reminder-title"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reminder-content">{t('reminder.fieldContent')}</Label>
                <textarea
                  id="reminder-content"
                  rows={4}
                  value={draft.content}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                  className={cn(
                    'min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
                  )}
                />
              </div>

              <div className="grid gap-2">
                <Label>{t('reminder.fieldLevel')}</Label>
                <Select
                  value={draft.level}
                  onValueChange={(value: ReminderLevel) =>
                    setDraft((prev) => ({ ...prev, level: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t(`reminder.level.${level}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="reminder-date">{t('reminder.fieldDate')}</Label>
                  <Input
                    id="reminder-date"
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reminder-time">{t('reminder.fieldTime')}</Label>
                  <Input
                    id="reminder-time"
                    type="time"
                    step={60}
                    value={draft.time}
                    onChange={(e) => setDraft((prev) => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="reminder-repeat-enabled">{t('reminder.fieldRepeat')}</Label>
                    <p className="text-xs text-muted-foreground">{t('reminder.fieldRepeatDesc')}</p>
                  </div>
                  <Switch
                    id="reminder-repeat-enabled"
                    checked={draft.repeatEnabled}
                    onCheckedChange={(repeatEnabled) =>
                      setDraft((prev) => ({ ...prev, repeatEnabled }))
                    }
                  />
                </div>
                {draft.repeatEnabled ? (
                  <div className="grid gap-2">
                    <Label>{t('reminder.fieldRepeatInterval')}</Label>
                    <Select
                      value={draft.repeatInterval}
                      onValueChange={(value: RepeatInterval) =>
                        setDraft((prev) => ({ ...prev, repeatInterval: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">{t('reminder.repeat.daily')}</SelectItem>
                        <SelectItem value="weekly">{t('reminder.repeat.weekly')}</SelectItem>
                        <SelectItem value="monthly">{t('reminder.repeat.monthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button disabled={saving} onClick={() => void handleSave()}>
                  {t('common.save')}
                </Button>
                {view === 'detail' ? (
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    {t('common.delete')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reminder.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reminder.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
