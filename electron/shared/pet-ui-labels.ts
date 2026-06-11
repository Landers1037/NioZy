import type { AppLocale } from './locale'
import type { ReminderLevel } from './reminder-settings'

export type PetUiLabels = {
  newTerminal: string
  viewReminders: string
  reminderListTitle: string
  reminderListEmpty: string
  reminderNextAt: string
  reminderDueTitle: string
  dismiss: string
  snooze5: string
  snooze15: string
  close: string
  level: Record<ReminderLevel, string>
}

const LABELS: Record<AppLocale, PetUiLabels> = {
  zh: {
    newTerminal: '新建终端',
    viewReminders: '查看提醒',
    reminderListTitle: '提醒事项',
    reminderListEmpty: '暂无提醒事项',
    reminderNextAt: '下次',
    reminderDueTitle: '提醒到点了',
    dismiss: '关闭提醒',
    snooze5: '推迟 5 分钟',
    snooze15: '推迟 15 分钟',
    close: '关闭',
    level: { urgent: '紧急', important: '重要', normal: '一般' },
  },
  en: {
    newTerminal: 'New terminal',
    viewReminders: 'View reminders',
    reminderListTitle: 'Reminders',
    reminderListEmpty: 'No reminders yet',
    reminderNextAt: 'Next',
    reminderDueTitle: 'Reminder due',
    dismiss: 'Dismiss',
    snooze5: 'Snooze 5 min',
    snooze15: 'Snooze 15 min',
    close: 'Close',
    level: { urgent: 'Urgent', important: 'Important', normal: 'Normal' },
  },
  ja: {
    newTerminal: '新しいターミナル',
    viewReminders: 'リマインダーを表示',
    reminderListTitle: 'リマインダー',
    reminderListEmpty: 'リマインダーはありません',
    reminderNextAt: '次回',
    reminderDueTitle: 'リマインダー時刻です',
    dismiss: '閉じる',
    snooze5: '5 分後に再通知',
    snooze15: '15 分後に再通知',
    close: '閉じる',
    level: { urgent: '緊急', important: '重要', normal: '通常' },
  },
}

export function getPetUiLabels(locale: AppLocale | undefined): PetUiLabels {
  return LABELS[locale ?? 'zh'] ?? LABELS.zh
}
