import type { AppSettings, CustomConnection } from './shared/api-types'

const SENSITIVE_KEY = /(?:password|apikey|secret|token|privatekey|keypath)$/i
const SENSITIVE_PATH = /\.(?:sshPassword|sshKeyPath|aiApiKey|openAiApiKey|value)$/i

function isSensitive(path: string, key: string): boolean {
  return SENSITIVE_KEY.test(key) || SENSITIVE_PATH.test(path)
}

function truncate(value: string, max = 160): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

function sanitizeScalar(path: string, key: string, value: unknown): unknown {
  if (value === undefined) return undefined
  if (isSensitive(path, key)) {
    if (typeof value === 'string') return value.trim() ? '[redacted]' : ''
    return '[redacted]'
  }
  if (typeof value === 'string') return truncate(value)
  return value
}

function summarizeConnection(c: CustomConnection): Record<string, unknown> {
  if (c.type === 'ssh') {
    return {
      id: c.id,
      name: c.name,
      type: 'ssh',
      host: c.sshHost,
      user: c.sshUser,
      port: c.sshPort,
      group: c.sshGroup,
      auth: c.sshAuth,
      hasPassword: Boolean(c.sshPassword?.trim()),
      hasKeyPath: Boolean(c.sshKeyPath?.trim()),
    }
  }
  return {
    id: c.id,
    name: c.name,
    type: 'command',
    command: c.command,
    argsCount: c.args?.length ?? 0,
  }
}

function flattenSettingsPatch(
  partial: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue
    const path = prefix ? `${prefix}.${key}` : key

    if (key === 'connections' && Array.isArray(value)) {
      out[path] = (value as CustomConnection[]).map(summarizeConnection)
      continue
    }

    if (key === 'lastWindowState' && value && typeof value === 'object') {
      const w = value as { width?: number; height?: number; maximized?: boolean }
      out[path] = { width: w.width, height: w.height, maximized: w.maximized }
      continue
    }

    if (key === 'builtinConnections' && value && typeof value === 'object') {
      const summary: Record<string, unknown> = {}
      for (const [shell, cfg] of Object.entries(
        value as Record<string, { args?: unknown[]; env?: object }>,
      )) {
        summary[shell] = {
          argsCount: cfg.args?.length ?? 0,
          envCount: cfg.env ? Object.keys(cfg.env).length : 0,
        }
      }
      out[path] = summary
      continue
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenSettingsPatch(value as Record<string, unknown>, path))
      continue
    }

    out[path] = sanitizeScalar(path, key, value)
  }

  return out
}

/** 将设置局部更新整理为可写入 INFO 日志的结构（敏感字段脱敏） */
export function summarizeSettingsPatch(partial: Partial<AppSettings>): Record<string, unknown> {
  return flattenSettingsPatch(partial as Record<string, unknown>)
}
