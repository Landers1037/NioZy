import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { ensureReminderDir, getReminderFilePath } from './config-paths'
import {
  advanceRemindAt,
  createEmptyReminderData,
  createReminderItem,
  isReminderCompleted,
  isReminderRepeating,
  shouldRemoveOnClearCompleted,
  normalizeReminderData,
  type ReminderDataFile,
  type ReminderItem,
  type ReminderRepeat,
} from './shared/reminder-data'
import type { ReminderLevel } from './shared/reminder-settings'

export type ReminderStoreListener = () => void

const ALLOWED_LEVELS = new Set<ReminderLevel>(['urgent', 'important', 'normal'])

function normalizeLevel(level: ReminderLevel | string | undefined): ReminderLevel {
  return typeof level === 'string' && ALLOWED_LEVELS.has(level as ReminderLevel)
    ? (level as ReminderLevel)
    : 'normal'
}

export class ReminderStore {
  private data: ReminderDataFile = createEmptyReminderData()
  private listeners = new Set<ReminderStoreListener>()

  constructor() {
    this.load()
  }

  onChange(listener: ReminderStoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyChange(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  load(): void {
    ensureReminderDir()
    const path = getReminderFilePath()
    if (!existsSync(path)) {
      this.data = createEmptyReminderData()
      return
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
      this.data = normalizeReminderData(raw)
    } catch {
      this.data = createEmptyReminderData()
    }
  }

  persist(): void {
    ensureReminderDir()
    writeFileSync(getReminderFilePath(), JSON.stringify(this.data, null, 2), 'utf-8')
  }

  list(): ReminderItem[] {
    return structuredClone(this.data.items)
  }

  getActiveItems(now = Date.now()): ReminderItem[] {
    return this.data.items.filter((item) => {
      if (item.dismissed) return false
      const at = Date.parse(item.remindAt)
      if (!Number.isFinite(at) || at > now) return false
      if (isReminderRepeating(item) && isReminderCompleted(item, now)) return false
      return true
    })
  }

  getNextRemindAtMs(now = Date.now()): number | null {
    let next: number | null = null
    for (const item of this.data.items) {
      if (item.dismissed) continue
      const at = Date.parse(item.remindAt)
      if (!Number.isFinite(at) || at <= now) continue
      if (next === null || at < next) next = at
    }
    return next
  }

  saveItem(input: {
    id?: string
    title: string
    content: string
    level: ReminderLevel
    remindAt: string
    dismissed?: boolean
    repeat?: ReminderRepeat
    occurrenceDoneAt?: string | null
  }): ReminderItem {
    const existingIndex =
      input.id !== undefined ? this.data.items.findIndex((item) => item.id === input.id) : -1
    const existing = existingIndex >= 0 ? this.data.items[existingIndex] : null
    const remindAtChanged =
      existing !== null && existing.remindAt !== input.remindAt
    const repeat = input.repeat ?? existing?.repeat ?? 'none'
    const item = createReminderItem({
      id: input.id ?? randomUUID(),
      title: input.title,
      content: input.content,
      level: normalizeLevel(input.level),
      remindAt: input.remindAt,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      dismissed: input.dismissed,
      repeat,
      occurrenceDoneAt: remindAtChanged
        ? null
        : (input.occurrenceDoneAt ?? existing?.occurrenceDoneAt ?? null),
    })
    if (existingIndex >= 0) {
      this.data.items[existingIndex] = item
    } else {
      this.data.items.push(item)
    }
    this.persist()
    this.notifyChange()
    return structuredClone(item)
  }

  deleteItem(id: string): void {
    const before = this.data.items.length
    this.data.items = this.data.items.filter((item) => item.id !== id)
    if (this.data.items.length === before) return
    this.persist()
    this.notifyChange()
  }

  snoozeItems(ids: string[], minutes: number): void {
    if (ids.length === 0 || minutes <= 0) return
    const idSet = new Set(ids)
    const nextAt = new Date(Date.now() + minutes * 60_000).toISOString()
    let changed = false
    for (const item of this.data.items) {
      if (!idSet.has(item.id)) continue
      item.remindAt = nextAt
      item.dismissed = false
      item.occurrenceDoneAt = null
      changed = true
    }
    if (!changed) return
    this.persist()
    this.notifyChange()
  }

  completeRepeatingOccurrences(ids: string[], now = Date.now()): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    let changed = false
    for (const item of this.data.items) {
      if (!idSet.has(item.id) || !isReminderRepeating(item)) continue
      item.occurrenceDoneAt = new Date(now).toISOString()
      item.remindAt = advanceRemindAt(item.remindAt, item.repeat)
      item.dismissed = false
      changed = true
    }
    if (!changed) return
    this.persist()
    this.notifyChange()
  }

  dismissItems(ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    let changed = false
    for (const item of this.data.items) {
      if (!idSet.has(item.id)) continue
      // 重复提醒在触发时已推进下次时间，关闭仅确认，勿再次推进
      if (isReminderRepeating(item)) continue
      item.dismissed = true
      changed = true
    }
    if (!changed) return
    this.persist()
    this.notifyChange()
  }

  clearCompleted(now = Date.now()): number {
    const before = this.data.items.length
    this.data.items = this.data.items.filter((item) => !shouldRemoveOnClearCompleted(item, now))
    const removed = before - this.data.items.length
    if (removed === 0) return 0
    this.persist()
    this.notifyChange()
    return removed
  }
}
