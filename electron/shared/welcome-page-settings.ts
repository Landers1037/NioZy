export type WelcomePageAnimationMode = 'niozy3d' | 'particles' | 'ascii'

export interface WelcomePageSettings {
  /** 启动且无会话恢复时展示欢迎页，不自动新建终端 */
  enabled: boolean
  animation: WelcomePageAnimationMode
}

export const WELCOME_PAGE_ANIMATION_MODES: WelcomePageAnimationMode[] = [
  'niozy3d',
  'particles',
  'ascii',
]

export const DEFAULT_WELCOME_PAGE_SETTINGS: WelcomePageSettings = {
  enabled: false,
  animation: 'niozy3d',
}

export function normalizeWelcomePageAnimationMode(value: unknown): WelcomePageAnimationMode {
  if (value === 'pixel') return 'particles'
  return WELCOME_PAGE_ANIMATION_MODES.includes(value as WelcomePageAnimationMode)
    ? (value as WelcomePageAnimationMode)
    : DEFAULT_WELCOME_PAGE_SETTINGS.animation
}

export function normalizeWelcomePageSettings(value: unknown): WelcomePageSettings {
  const stored = value as Partial<WelcomePageSettings> | undefined
  return {
    enabled:
      typeof stored?.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_WELCOME_PAGE_SETTINGS.enabled,
    animation: normalizeWelcomePageAnimationMode(stored?.animation),
  }
}

export function isWelcomePageEnabled(
  settings: { terminal?: { welcomePage?: WelcomePageSettings } } | null | undefined,
): boolean {
  return settings?.terminal?.welcomePage?.enabled === true
}
