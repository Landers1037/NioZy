import { Notification } from 'electron'
import type { BrowserWindow } from 'electron'
import { getReminderImagePath } from './config-paths'
import {
  getReminderImageUrlFromExt,
  reminderImageExists,
} from './reminder-image-service'
import type { ReminderStore } from './reminder-store'
import type { SettingsStore } from './settings-store'
import type { ReminderDuePayload, ReminderItem } from './shared/reminder-data'
import { isReminderRepeating } from './shared/reminder-data'

const FALLBACK_CHECK_MS = 60_000

export class ReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private fallbackTimer: ReturnType<typeof setInterval> | null = null
  private firing = false
  private unsubStore: (() => void) | null = null
  /** 已推送但未 dismiss/snooze 的提醒，避免重复触发 */
  private pendingAlertIds = new Set<string>()

  constructor(
    private readonly reminderStore: ReminderStore,
    private readonly settingsStore: SettingsStore,
    private readonly sendDue: (mainWindow: BrowserWindow | null, payload: ReminderDuePayload) => void,
    private readonly getMainWindow: () => BrowserWindow | null,
  ) {}

  start(): void {
    if (this.unsubStore) return
    this.unsubStore = this.reminderStore.onChange(() => this.reschedule())
    this.reschedule()
  }

  stop(): void {
    this.unsubStore?.()
    this.unsubStore = null
    this.clearTimers()
  }

  reschedule(): void {
    this.clearTimers()
    this.syncPendingAlerts()
    const settings = this.settingsStore.get().reminder
    if (!settings.enabled) return

    this.fallbackTimer = setInterval(() => {
      void this.checkDue()
    }, FALLBACK_CHECK_MS)

    const nextMs = this.reminderStore.getNextRemindAtMs()
    const now = Date.now()
    if (nextMs !== null) {
      const delay = Math.max(0, nextMs - now)
      this.timer = setTimeout(() => {
        void this.checkDue()
      }, delay)
    }

    void this.checkDue()
  }

  private clearTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer)
      this.fallbackTimer = null
    }
  }

  private async checkDue(): Promise<void> {
    if (this.firing) return
    const settings = this.settingsStore.get().reminder
    if (!settings.enabled) return

    const dueItems = this.reminderStore
      .getActiveItems()
      .filter((item) => !this.pendingAlertIds.has(item.id))
    if (dueItems.length === 0) {
      this.scheduleNextTimeout()
      return
    }

    this.firing = true
    try {
      this.fireDueItems(dueItems)
      const repeatIds = dueItems.filter((item) => isReminderRepeating(item)).map((item) => item.id)
      if (repeatIds.length > 0) {
        this.reminderStore.completeRepeatingOccurrences(repeatIds)
      }
    } finally {
      this.firing = false
      this.scheduleNextTimeout()
    }
  }

  private scheduleNextTimeout(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const settings = this.settingsStore.get().reminder
    if (!settings.enabled) return
    const nextMs = this.reminderStore.getNextRemindAtMs()
    if (nextMs === null) return
    const delay = Math.max(0, nextMs - Date.now())
    this.timer = setTimeout(() => {
      void this.checkDue()
    }, delay)
  }

  private fireDueItems(items: ReminderItem[]): void {
    const settings = this.settingsStore.get().reminder
    const imageUrl = getReminderImageUrlFromExt(settings.customImageExt)
    const payload: ReminderDuePayload = {
      items: structuredClone(items),
      imageUrl,
    }

    for (const item of items) {
      this.pendingAlertIds.add(item.id)
    }

    this.sendDue(this.getMainWindow(), payload)

    if (settings.systemNotification) {
      this.showSystemNotification(items, settings.customImageExt)
    }
  }

  private syncPendingAlerts(): void {
    const items = this.reminderStore.list()
    const byId = new Map(items.map((item) => [item.id, item]))
    const now = Date.now()
    for (const id of this.pendingAlertIds) {
      const item = byId.get(id)
      if (!item || item.dismissed) {
        this.pendingAlertIds.delete(id)
        continue
      }
      const at = Date.parse(item.remindAt)
      if (!Number.isFinite(at) || at > now) {
        this.pendingAlertIds.delete(id)
      }
    }
  }

  private showSystemNotification(items: ReminderItem[], imageExt: string | null): void {
    if (!Notification.isSupported()) return

    const title =
      items.length === 1
        ? items[0].title || '提醒事项'
        : `${items.length} 条提醒事项`

    const body =
      items.length === 1
        ? truncateText(items[0].content || items[0].title, 200)
        : items
            .slice(0, 5)
            .map((item) => item.title)
            .join('\n')

    const options: Electron.NotificationConstructorOptions = { title, body }
    if (imageExt && reminderImageExists(imageExt)) {
      options.icon = getReminderImagePath(imageExt)
    }

    new Notification(options).show()
  }
}

function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}
