import type { TFunction } from 'i18next'
import type { ReminderLevel } from '../../electron/shared/reminder-settings'
import { cn } from '@/lib/utils'
import { reminderLevelTagClass } from '@/lib/reminder-utils'

export function reminderLevelLabel(level: ReminderLevel, t: TFunction): string {
  switch (level) {
    case 'urgent':
      return t('reminder.level.urgent')
    case 'important':
      return t('reminder.level.important')
    case 'normal':
      return t('reminder.level.normal')
  }
}

export function ReminderLevelTag({
  level,
  t,
  className,
}: {
  level: ReminderLevel
  t: TFunction
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        reminderLevelTagClass(level),
        className,
      )}
    >
      {reminderLevelLabel(level, t)}
    </span>
  )
}
