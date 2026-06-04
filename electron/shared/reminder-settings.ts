export type ReminderNotifyMode = 'toast' | 'dialog'

export type ReminderLevel = 'urgent' | 'important' | 'normal'

export interface ReminderSettings {
  /** 开启提醒事项（控制顶栏按钮与调度） */
  enabled: boolean
  /** 到点时额外调用 Windows 系统通知 */
  systemNotification: boolean
  notifyMode: ReminderNotifyMode
  soundEnabled: boolean
  /** Toast 停留时长（秒），仅 toast 模式生效 */
  toastDurationSec: number
  /** 自定义提醒图后缀（jpg/png/gif），无则为 null */
  customImageExt: string | null
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  systemNotification: false,
  notifyMode: 'toast',
  soundEnabled: false,
  toastDurationSec: 3,
  customImageExt: null,
}

const ALLOWED_NOTIFY_MODES = new Set<ReminderNotifyMode>(['toast', 'dialog'])

export function normalizeReminderSettings(
  stored: Partial<ReminderSettings> | undefined,
): ReminderSettings {
  const mode = stored?.notifyMode
  return {
    enabled:
      typeof stored?.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_REMINDER_SETTINGS.enabled,
    systemNotification:
      typeof stored?.systemNotification === 'boolean'
        ? stored.systemNotification
        : DEFAULT_REMINDER_SETTINGS.systemNotification,
    notifyMode:
      typeof mode === 'string' && ALLOWED_NOTIFY_MODES.has(mode as ReminderNotifyMode)
        ? (mode as ReminderNotifyMode)
        : DEFAULT_REMINDER_SETTINGS.notifyMode,
    soundEnabled:
      typeof stored?.soundEnabled === 'boolean'
        ? stored.soundEnabled
        : DEFAULT_REMINDER_SETTINGS.soundEnabled,
    toastDurationSec:
      typeof stored?.toastDurationSec === 'number' &&
      Number.isFinite(stored.toastDurationSec) &&
      stored.toastDurationSec >= 1
        ? Math.round(stored.toastDurationSec)
        : DEFAULT_REMINDER_SETTINGS.toastDurationSec,
    customImageExt:
      typeof stored?.customImageExt === 'string' && stored.customImageExt.trim()
        ? stored.customImageExt.replace(/^\./, '').toLowerCase()
        : stored?.customImageExt === null
          ? null
          : DEFAULT_REMINDER_SETTINGS.customImageExt,
  }
}
