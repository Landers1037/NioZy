import type { SshConnectionProfile } from './shared/ssh-types'
import { createAppLogger } from './app-log'

const log = createAppLogger('[NioZy][SCP]')

export function scpLog(message: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) log.info(message, extra)
  else log.info(message)
}

export function scpLogWarn(message: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) log.warn(message, extra)
  else log.warn(message)
}

export function scpLogError(message: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) log.error(message, extra)
  else log.error(message)
}

export function scpProfileForLog(profile: SshConnectionProfile): Record<string, unknown> {
  return {
    host: profile.host,
    user: profile.user,
    port: profile.port,
    hasKey: Boolean(profile.keyPath?.trim()),
    hasPassword: Boolean(profile.password),
  }
}

export function scpCommandForLog(executable: string, args: string[]): string {
  return [executable, ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ')
}

export function scpOutputPreview(text: string, maxLen = 400): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

export function logScpProfile(label: string, profile: SshConnectionProfile): void {
  scpLog(label, scpProfileForLog(profile))
}

export function logScpSpawn(
  label: string,
  executable: string,
  args: string[],
  extra?: Record<string, unknown>,
): void {
  scpLog(`${label} start`, { cmd: scpCommandForLog(executable, args), ...extra })
}

export function logScpDone(
  message: string,
  extra: {
    ms: number
    code?: number | null
    stderr?: string
    stdoutChars?: number
    ok?: boolean
    entryCount?: number
  },
): void {
  const detail: Record<string, unknown> = { ms: extra.ms }
  if (extra.code != null) detail.code = extra.code
  if (extra.entryCount != null) detail.entryCount = extra.entryCount
  if (extra.ok != null) detail.ok = extra.ok
  if (extra.stdoutChars != null) detail.stdoutChars = extra.stdoutChars
  const stderrPreview = extra.stderr?.trim() ? scpOutputPreview(extra.stderr) : ''
  if (stderrPreview) detail.stderr = stderrPreview

  if (extra.code != null && extra.code !== 0) {
    scpLogWarn(message, detail)
  } else {
    scpLog(message, detail)
  }
}

export function logScpWarn(
  label: string,
  message: string | Record<string, unknown>,
  extra?: Record<string, unknown>,
): void {
  if (typeof message === 'string') {
    scpLogWarn(label, { message, ...extra })
  } else {
    scpLogWarn(label, { ...message, ...extra })
  }
}

export function logScpError(label: string, err: unknown): void {
  const error = err instanceof Error ? err.message : String(err)
  scpLogError(label, { error })
}
