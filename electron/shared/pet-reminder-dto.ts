import {
  getReminderNextRemindAt,
  isReminderRepeating,
  isRepeatOccurrenceDoneToday,
  type ReminderItem,
} from './reminder-data'

export type PetReminderListItemDto = {
  id: string
  title: string
  content: string
  level: ReminderItem['level']
  remindAt: string
  nextRemindAt: string
  repeat: ReminderItem['repeat']
  isDue: boolean
}

export function toPetReminderListItem(item: ReminderItem, now = Date.now()): PetReminderListItemDto {
  const at = Date.parse(item.remindAt)
  const repeating = isReminderRepeating(item)
  const isDue =
    !item.dismissed &&
    Number.isFinite(at) &&
    at <= now &&
    !(repeating && isRepeatOccurrenceDoneToday(item, now))
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    level: item.level,
    remindAt: item.remindAt,
    nextRemindAt: getReminderNextRemindAt(item, now),
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
