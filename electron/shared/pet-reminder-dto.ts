import type { ReminderItem } from './reminder-data'

export type PetReminderListItemDto = {
  id: string
  title: string
  content: string
  level: ReminderItem['level']
  remindAt: string
  repeat: ReminderItem['repeat']
  isDue: boolean
}

export function toPetReminderListItem(item: ReminderItem, now = Date.now()): PetReminderListItemDto {
  const at = Date.parse(item.remindAt)
  const isDue = !item.dismissed && Number.isFinite(at) && at <= now
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    level: item.level,
    remindAt: item.remindAt,
    repeat: item.repeat,
    isDue,
  }
}

export function listPetReminderItems(items: ReminderItem[], now = Date.now()): PetReminderListItemDto[] {
  return items
    .filter((item) => !item.dismissed)
    .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt))
    .map((item) => toPetReminderListItem(item, now))
}
