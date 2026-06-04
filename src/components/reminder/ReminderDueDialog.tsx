import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReminderLevelTag } from '@/lib/reminder-level-tag'
import { formatReminderDateTime } from '@/lib/reminder-utils'
import { useReminderStore } from '@/stores/reminder-store'

const SNOOZE_MINUTES = [5, 15, 30] as const

export function ReminderDueDialog() {
  const { t } = useTranslation()
  const open = useReminderStore((s) => s.dueDialogOpen)
  const payload = useReminderStore((s) => s.duePayload)
  const snoozeItems = useReminderStore((s) => s.snoozeItems)
  const dismissItems = useReminderStore((s) => s.dismissItems)
  const closeDueDialog = useReminderStore((s) => s.closeDueDialog)

  if (!payload) return null

  const items = payload.items
  const ids = items.map((item) => item.id)
  const isSingle = items.length === 1
  const single = isSingle ? items[0] : null

  const handleSnooze = (minutes: number) => {
    void snoozeItems(ids, minutes)
  }

  const handleDismiss = () => {
    void dismissItems(ids)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDueDialog()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reminder.dueTitle')}</DialogTitle>
        </DialogHeader>

        {payload.imageUrl && !isSingle ? (
          <div className="flex justify-center py-2">
            <img
              src={payload.imageUrl}
              alt=""
              className="max-h-40 max-w-full object-contain"
            />
          </div>
        ) : null}

        {isSingle && single ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ReminderLevelTag level={single.level} t={t} className="w-fit" />
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatReminderDateTime(single.remindAt)}
              </span>
            </div>
            <p className="text-base font-semibold">{single.title}</p>
            {payload.imageUrl ? (
              <div className="flex justify-center py-1">
                <img
                  src={payload.imageUrl}
                  alt=""
                  className="max-h-40 max-w-full object-contain"
                />
              </div>
            ) : null}
            {single.content.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{single.content}</p>
            ) : null}
          </div>
        ) : (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ReminderLevelTag level={item.level} t={t} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatReminderDateTime(item.remindAt)}
                  </span>
                </div>
                <span className="min-w-0 truncate text-sm font-medium">{item.title}</span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <div className="flex flex-wrap gap-2">
            {SNOOZE_MINUTES.map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                size="sm"
                onClick={() => handleSnooze(minutes)}
              >
                {t('reminder.snoozeMinutes', { minutes })}
              </Button>
            ))}
          </div>
          <Button variant="default" onClick={handleDismiss}>
            {t('reminder.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
