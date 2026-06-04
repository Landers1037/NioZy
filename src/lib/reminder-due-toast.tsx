import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { ReminderLevelTag } from '@/lib/reminder-level-tag'
import { formatReminderDateTime, truncateReminderText } from '@/lib/reminder-utils'
import type { ReminderItem } from '../../electron/shared/reminder-data'

export function showReminderDueToast(item: ReminderItem, durationSec: number) {
  toast.custom(
    () => (
      <div className="relative w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg">
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <ReminderLevelTag level={item.level} t={i18n.t.bind(i18n)} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatReminderDateTime(item.remindAt)}
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug text-foreground">{item.title}</p>
          {item.content.trim() ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {truncateReminderText(item.content, 120)}
            </p>
          ) : null}
        </div>
      </div>
    ),
    { duration: Math.max(1000, durationSec * 1000), unstyled: true },
  )
}
