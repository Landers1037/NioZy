export const SETTINGS_IMPORT_MAX_BYTES = 4 * 1024 * 1024

export type SettingsImportParseError = 'INVALID_JSON' | 'INVALID_FORMAT' | 'TOO_LARGE'

export function parseSettingsExportBody(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('INVALID_FORMAT')
  }
  const raw = data as Record<string, unknown>
  if (
    raw.settings &&
    typeof raw.settings === 'object' &&
    !Array.isArray(raw.settings)
  ) {
    return raw.settings as Record<string, unknown>
  }
  return raw
}

export function parseSettingsImportContent(
  content: string,
): { ok: true; body: Record<string, unknown> } | { ok: false; error: SettingsImportParseError } {
  if (content.length > SETTINGS_IMPORT_MAX_BYTES) {
    return { ok: false, error: 'TOO_LARGE' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    return { ok: false, error: 'INVALID_JSON' }
  }
  try {
    const body = parseSettingsExportBody(parsed)
    return { ok: true, body }
  } catch {
    return { ok: false, error: 'INVALID_FORMAT' }
  }
}
