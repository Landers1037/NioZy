import type { ReminderLevel } from './reminder-settings'

export interface ReminderItem {
  id: string
  title: string
  content: string
  level: ReminderLevel
  /** ISO 8601，精确到分 */
  remindAt: string
  /** ISO 8601，列表按此降序 */
  createdAt: string
  /** 关闭提醒后不再触发 */
  dismissed: boolean
}

export interface ReminderDataFile {
  items: ReminderItem[]
}

export interface ReminderDuePayload {
  items: ReminderItem[]
  imageUrl: string | null
}

const ALLOWED_LEVELS = new Set<ReminderLevel>(['urgent', 'important', 'normal'])

function normalizeLevel(value: unknown): ReminderLevel {
  return typeof value === 'string' && ALLOWED_LEVELS.has(value as ReminderLevel)
    ? (value as ReminderLevel)
    : 'normal'
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
}): ReminderItem {
  return {
    id: input.id,
    title: input.title.trim(),
    content: input.content,
    level: input.level,
    remindAt: input.remindAt,
    createdAt: input.createdAt ?? new Date().toISOString(),
    dismissed: input.dismissed === true,
  }
}

/** 尚未到点触发（提醒时间在未来） */
export function isReminderUntriggered(item: ReminderItem, now = Date.now()): boolean {
  if (item.dismissed) return false
  const at = Date.parse(item.remindAt)
  return Number.isFinite(at) && at > now
}

/** 已到点或已关闭提醒 */
export function isReminderCompleted(item: ReminderItem, now = Date.now()): boolean {
  if (item.dismissed) return true
  const at = Date.parse(item.remindAt)
  return Number.isFinite(at) && at <= now
}
