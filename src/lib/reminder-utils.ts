import type { ReminderLevel } from '../../electron/shared/reminder-settings'

export const REMINDER_LEVELS: ReminderLevel[] = ['urgent', 'important', 'normal']

const LEVEL_TAG_STYLES: Record<ReminderLevel, string> = {
  urgent:
    'border-red-600/25 bg-red-600/14 text-red-950 dark:border-red-400/30 dark:bg-red-400/20 dark:text-red-50',
  important:
    'border-amber-600/25 bg-amber-600/14 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-50',
  normal:
    'border-sky-600/25 bg-sky-600/14 text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/20 dark:text-sky-50',
}

export function reminderLevelTagClass(level: ReminderLevel): string {
  return LEVEL_TAG_STYLES[level]
}

export function formatReminderDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export function splitRemindAt(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    const now = new Date()
    return {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    }
  }
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  }
}

export function combineRemindAt(date: string, time: string): string {
  const [y, m, d] = date.split('-').map((part) => Number.parseInt(part, 10))
  const [h, min] = time.split(':').map((part) => Number.parseInt(part, 10))
  if ([y, m, d, h, min].some((n) => Number.isNaN(n))) {
    return new Date().toISOString()
  }
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString()
}

export function truncateReminderText(text: string, maxLen: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}
