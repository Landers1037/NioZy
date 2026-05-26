export const APP_LOCALES = ['zh', 'en', 'ja'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'zh'

export function normalizeLocale(value: unknown): AppLocale {
  if (value === 'en' || value === 'ja') return value
  return 'zh'
}
