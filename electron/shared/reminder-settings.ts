import { normalizePetAnimationStateId } from './pet-animation-states'
import { normalizePetDisplayScale } from './pet-atlas'

export type ReminderNotifyMode = 'toast' | 'dialog'

export type ReminderLevel = 'urgent' | 'important' | 'normal'

export interface DesktopPetPosition {
  x: number
  y: number
}

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
  /** 在桌面显示悬浮宠物按钮 */
  desktopPetEnabled: boolean
  /** 当前选中的宠物目录名（pets 下子目录），无宠物时为 null */
  desktopPetId: string | null
  /** 当前播放的动画状态（对应精灵图行） */
  desktopPetAnimationState: string
  /** 开启后每 10s 随机切换动画状态 */
  desktopPetRandomState: boolean
  /** 桌面宠物上次位置（屏幕坐标），无则使用默认位置 */
  desktopPetPosition: DesktopPetPosition | null
  /** 桌面宠物显示缩放（0.25–2，步长 0.01） */
  desktopPetScale: number
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  systemNotification: false,
  notifyMode: 'toast',
  soundEnabled: false,
  toastDurationSec: 3,
  customImageExt: null,
  desktopPetEnabled: false,
  desktopPetId: null,
  desktopPetAnimationState: 'idle',
  desktopPetRandomState: false,
  desktopPetPosition: null,
  desktopPetScale: normalizePetDisplayScale(undefined),
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
    desktopPetEnabled:
      typeof stored?.desktopPetEnabled === 'boolean'
        ? stored.desktopPetEnabled
        : DEFAULT_REMINDER_SETTINGS.desktopPetEnabled,
    desktopPetId: normalizeDesktopPetId(stored?.desktopPetId),
    desktopPetAnimationState: normalizePetAnimationStateId(stored?.desktopPetAnimationState),
    desktopPetRandomState:
      typeof stored?.desktopPetRandomState === 'boolean'
        ? stored.desktopPetRandomState
        : DEFAULT_REMINDER_SETTINGS.desktopPetRandomState,
    desktopPetPosition: normalizeDesktopPetPosition(stored?.desktopPetPosition),
    desktopPetScale: normalizePetDisplayScale(stored?.desktopPetScale),
  }
}

function normalizeDesktopPetId(stored: string | null | undefined): string | null {
  if (stored === null) return null
  if (typeof stored !== 'string' || !stored.trim()) return DEFAULT_REMINDER_SETTINGS.desktopPetId
  const trimmed = stored.trim()
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return DEFAULT_REMINDER_SETTINGS.desktopPetId
  return trimmed
}

function normalizeDesktopPetPosition(
  stored: Partial<DesktopPetPosition> | null | undefined,
): DesktopPetPosition | null {
  if (stored === null) return null
  if (!stored || typeof stored !== 'object') return DEFAULT_REMINDER_SETTINGS.desktopPetPosition
  const x = stored.x
  const y = stored.y
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return DEFAULT_REMINDER_SETTINGS.desktopPetPosition
  }
  return { x: Math.round(x), y: Math.round(y) }
}
