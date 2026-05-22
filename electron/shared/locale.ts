export const APP_LOCALES = ['zh', 'en'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'zh'

export function normalizeLocale(value: unknown): AppLocale {
  return value === 'en' ? 'en' : 'zh'
}
