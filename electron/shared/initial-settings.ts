import type { AppSettings } from './api-types'

export const INITIAL_SETTINGS_ARG_PREFIX = '--niozy-initial-settings='

export function parseInitialSettingsFromArgv(argv: readonly string[]): AppSettings | null {
  const arg = argv.find((entry) => entry.startsWith(INITIAL_SETTINGS_ARG_PREFIX))
  if (!arg) return null
  try {
    return JSON.parse(
      decodeURIComponent(arg.slice(INITIAL_SETTINGS_ARG_PREFIX.length)),
    ) as AppSettings
  } catch {
    return null
  }
}

export function buildInitialSettingsArgv(settings: AppSettings): string {
  return INITIAL_SETTINGS_ARG_PREFIX + encodeURIComponent(JSON.stringify(settings))
}
