export interface AssistiveSettings {
  pomodoroEnabled: boolean
  commandReplayEnabled: boolean
  terminalSearchEnabled: boolean
  connectivityCheckEnabled: boolean
  screenshotEnabled: boolean
  notesEnabled: boolean
}

export const DEFAULT_ASSISTIVE_SETTINGS: AssistiveSettings = {
  pomodoroEnabled: true,
  commandReplayEnabled: true,
  terminalSearchEnabled: true,
  connectivityCheckEnabled: true,
  screenshotEnabled: true,
  notesEnabled: true,
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeAssistiveSettings(value: unknown): AssistiveSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    pomodoroEnabled: normalizeBool(raw.pomodoroEnabled, DEFAULT_ASSISTIVE_SETTINGS.pomodoroEnabled),
    commandReplayEnabled: normalizeBool(
      raw.commandReplayEnabled,
      DEFAULT_ASSISTIVE_SETTINGS.commandReplayEnabled,
    ),
    terminalSearchEnabled: normalizeBool(
      raw.terminalSearchEnabled,
      DEFAULT_ASSISTIVE_SETTINGS.terminalSearchEnabled,
    ),
    connectivityCheckEnabled: normalizeBool(
      raw.connectivityCheckEnabled,
      DEFAULT_ASSISTIVE_SETTINGS.connectivityCheckEnabled,
    ),
    screenshotEnabled: normalizeBool(
      raw.screenshotEnabled,
      DEFAULT_ASSISTIVE_SETTINGS.screenshotEnabled,
    ),
    notesEnabled: normalizeBool(raw.notesEnabled, DEFAULT_ASSISTIVE_SETTINGS.notesEnabled),
  }
}

