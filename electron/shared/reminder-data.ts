import type { ReminderLevel } from './reminder-settings'

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export const REMINDER_REPEAT_VALUES: ReminderRepeat[] = ['none', 'daily', 'weekly', 'monthly']

export interface ReminderItem {
  id: string
  title: string
  content: string
  level: ReminderLevel
  /** ISO 8601，精确到分 */
  remindAt: string
  /** ISO 8601，列表按此降序 */
  createdAt: string
  /** 关闭提醒后不再触发（仅非重复提醒） */
  dismissed: boolean
  /** 重复周期；none 表示不重复 */
  repeat: ReminderRepeat
  /** 当前周期已于何时完成（用于重复提醒当日已完成展示） */
  occurrenceDoneAt: string | null
}

export interface ReminderDataFile {
  items: ReminderItem[]
}

export interface ReminderDuePayload {
  items: ReminderItem[]
  imageUrl: string | null
}

const ALLOWED_LEVELS = new Set<ReminderLevel>(['urgent', 'important', 'normal'])
const ALLOWED_REPEAT = new Set<ReminderRepeat>(REMINDER_REPEAT_VALUES)

function normalizeLevel(value: unknown): ReminderLevel {
  return typeof value === 'string' && ALLOWED_LEVELS.has(value as ReminderLevel)
    ? (value as ReminderLevel)
    : 'normal'
}

function normalizeRepeat(value: unknown): ReminderRepeat {
  return typeof value === 'string' && ALLOWED_REPEAT.has(value as ReminderRepeat)
    ? (value as ReminderRepeat)
    : 'none'
}

function normalizeOccurrenceDoneAt(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

function normalizeItem(raw: unknown): ReminderItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const item = raw as Partial<ReminderItem>
  if (typeof item.id !== 'string' || !item.id.trim()) return null
  if (typeof item.title !== 'string') return null
  if (typeof item.content !== 'string') return null
  if (typeof item.remindAt !== 'string' || !item.remindAt.trim()) return null
  if (typeof item.createdAt !== 'string' || !item.createdAt.trim()) return null
  return {
    id: item.id.trim(),
    title: item.title,
    content: item.content,
    level: normalizeLevel(item.level),
    remindAt: item.remindAt.trim(),
    createdAt: item.createdAt.trim(),
    dismissed: item.dismissed === true,
    repeat: normalizeRepeat(item.repeat),
    occurrenceDoneAt: normalizeOccurrenceDoneAt(item.occurrenceDoneAt),
  }
}

export function createEmptyReminderData(): ReminderDataFile {
  return { items: [] }
}

export function normalizeReminderData(raw: unknown): ReminderDataFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyReminderData()
  }
  const itemsRaw = (raw as Partial<ReminderDataFile>).items
  if (!Array.isArray(itemsRaw)) return createEmptyReminderData()
  const items = itemsRaw
    .map(normalizeItem)
    .filter((item): item is ReminderItem => item !== null)
  return { items }
}

export function createReminderItem(input: {
  id: string
  title: string
  content: string
  level: ReminderLevel
  remindAt: string
  createdAt?: string
  dismissed?: boolean
  repeat?: ReminderRepeat
  occurrenceDoneAt?: string | null
}): ReminderItem {
  return {
    id: input.id,
    title: input.title.trim(),
    content: input.content,
    level: input.level,
    remindAt: input.remindAt,
    createdAt: input.createdAt ?? new Date().toISOString(),
    dismissed: input.dismissed === true,
    repeat: normalizeRepeat(input.repeat),
    occurrenceDoneAt: normalizeOccurrenceDoneAt(input.occurrenceDoneAt),
  }
}

export function localDateKey(msOrIso: number | string): string {
  const d = typeof msOrIso === 'number' ? new Date(msOrIso) : new Date(msOrIso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isReminderRepeating(item: ReminderItem): boolean {
  return item.repeat !== 'none'
}

/** 将 remindAt 推进到下一周期（保持本地时分） */
export function advanceRemindAt(iso: string, repeat: ReminderRepeat): string {
  if (repeat === 'none') return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hour = d.getHours()
  const minute = d.getMinutes()
  const second = d.getSeconds()
  if (repeat === 'daily') {
    d.setDate(d.getDate() + 1)
  } else if (repeat === 'weekly') {
    d.setDate(d.getDate() + 7)
  } else if (repeat === 'monthly') {
    d.setMonth(d.getMonth() + 1)
  }
  d.setHours(hour, minute, second, 0)
  return d.toISOString()
}

/** 重复提醒：今日周期是否已完成 */
export function isRepeatOccurrenceDoneToday(item: ReminderItem, now = Date.now()): boolean {
  if (!isReminderRepeating(item) || !item.occurrenceDoneAt) return false
  const doneDay = localDateKey(item.occurrenceDoneAt)
  const today = localDateKey(now)
  return doneDay !== '' && doneDay === today
}

/** 尚未到点触发（提醒时间在未来，或重复项今日已完成并已排下次） */
export function isReminderUntriggered(item: ReminderItem, now = Date.now()): boolean {
  if (item.dismissed) return false
  if (isRepeatOccurrenceDoneToday(item, now)) {
    const at = Date.parse(item.remindAt)
    return Number.isFinite(at) && at > now
  }
  const at = Date.parse(item.remindAt)
  return Number.isFinite(at) && at > now
}

/** 已到点或已关闭提醒；重复项在今日执行后视为已完成 */
export function isReminderCompleted(item: ReminderItem, now = Date.now()): boolean {
  if (item.dismissed) return true
  if (isReminderRepeating(item)) {
    return isRepeatOccurrenceDoneToday(item, now)
  }
  const at = Date.parse(item.remindAt)
  return Number.isFinite(at) && at <= now
}
