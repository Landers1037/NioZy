export type LogHighlightLevel = 'error' | 'warning' | 'info' | 'success'

export const LOG_HIGHLIGHT_COLORS: Record<LogHighlightLevel, string> = {
  error: '#f14c4c',
  warning: '#cca700',
  info: '#3794ff',
  success: '#89d185',
}

/**
 * 词边界近似 MobaXterm CustomSyntax.ini「OK/warning/error keywords」：
 * 前后字符不为 [A-Za-z0-9_&-] / [A-Za-z0-9_-]
 * @see https://github.com/wezterm/wezterm/issues/4348
 */
const WB = String.raw`(?:^|[^A-Za-z0-9_&-])`
const WE = String.raw`(?:[^A-Za-z0-9_-]|$)`

function mobaWords(...words: string[]): RegExp {
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`${WB}(${alt})${WE}`, 'i')
}

function mobaPhrases(...phrases: string[]): RegExp {
  const alt = phrases
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, String.raw`\s+`))
    .join('|')
  return new RegExp(`${WB}(${alt})${WE}`, 'i')
}

/** 赋值/键值形式的布尔结果，如 `= false`、`:"no"` */
const MOBA_ASSIGN_FALSE = new RegExp(
  String.raw`[=>"':.,;({\[]\s*((?:false|no|ko))\s*[\]=>"':.,;)}\]]`,
  'i',
)
const MOBA_ASSIGN_TRUE = new RegExp(
  String.raw`[=>"':.,;({\[]\s*((?:true|yes|ok))\s*[\]=>"':.,;)}\]]`,
  'i',
)

export type LogHighlightSpan = {
  start: number
  end: number
  level: LogHighlightLevel
  color: string
}

type HighlightCheck = {
  level: LogHighlightLevel
  pattern: RegExp
  group?: number
}

/**
 * 按优先级匹配（先 error → warning → success → info）。
 * 规则源自 MobaXterm 内置「Default (OK/warning/error keywords)」并做适度精简。
 */
const LOG_HIGHLIGHT_CHECKS: ReadonlyArray<HighlightCheck> = [
  // 特定 info 须先于泛化 error 关键字（避免 "last failed login" 命中 failed）
  { level: 'info', pattern: mobaPhrases('last login', 'last failed login') },

  // ── Error（红）──
  { level: 'error', pattern: /^\s*(ERROR)\b/i },
  { level: 'error', pattern: /^\s*(FATAL)\b/i },
  { level: 'error', pattern: /^\s*\[((?:ERROR|ERR))\]/i },
  { level: 'error', pattern: /\b(ERROR)\s+\d+[\s:(]/i },
  { level: 'error', pattern: /^\s*(Exception)\b/i },
  { level: 'error', pattern: mobaPhrases(
    'segmentation fault',
    'access denied',
    'permission denied',
    'authentication failed',
    'authentication refused',
    'connection refused',
    'operation denied',
    'not permitted',
    'not allowed',
    'not supported',
    'not implemented',
    'not properly',
    'improperly',
    'bad file',
    'bad memory',
    'no such file',
  ) },
  { level: 'error', pattern: /\b(no\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\s+found)\b/i },
  { level: 'error', pattern: mobaWords(
    'failed',
    'failure',
    'invalid',
    'unsupported',
    'incorrect',
    'improper',
    'corrupt',
    'corrupted',
    'corruption',
    'overflow',
    'underrun',
    'unimplemented',
    'unsuccessful',
    'unsuccessfull',
    'permerror',
    // 多语言 error
    'fehler',
    'errore',
    'erreur',
    'fejl',
    'virhe',
    'fel',
    'erro',
    'greška',
  ) },
  { level: 'error', pattern: mobaWords('bad', 'wrong') },
  { level: 'error', pattern: mobaWords('error', 'errors') },
  { level: 'error', pattern: /\(((?:ee|ni))\)/i },
  { level: 'error', pattern: MOBA_ASSIGN_FALSE, group: 1 },

  // ── Warning（黄）──
  { level: 'warning', pattern: /^\s*(WARN(?:ING)?)\b/i },
  { level: 'warning', pattern: /^\s*\[(WARN(?:ING)?)\]/i },
  { level: 'warning', pattern: /\[((?:\-w[A-Za-z-]+))\]/i },
  { level: 'warning', pattern: /\b(caught signal \d+)\b/i },
  { level: 'warning', pattern: mobaPhrases(
    'could not',
    'unable to',
    'not responding',
    'connection closed',
    'connection terminated',
    'connection stopped',
    'connection to remote host',
    'no more',
    'command not found',
    'binary not found',
    'file not found',
    'out of space',
    'out of memory',
    'low memory',
    'low disk',
  ) },
  { level: 'warning', pattern: mobaWords(
    'cannot',
    'unexpected',
    'exited',
    'unknown',
    'disabled',
    'disconnected',
    'deprecated',
    'attention',
    'exclamation',
    // 多语言 warning
    'warnings',
    'warning',
    'advertencia',
    'avvertimento',
    'achtung',
    'alerts',
    'alert',
    'warnungs',
    'advarsel',
    'pedwarn',
    'aviso',
    'varoitus',
    'upozorenje',
    'peringatan',
    'uyari',
    'varning',
    'avertissement',
  ) },
  { level: 'warning', pattern: /\b(o+ps)\b/i },
  { level: 'warning', pattern: /\(((?:ww|\?\?))\)/i },

  // ── Success（绿）──
  { level: 'success', pattern: /^\s*((?:SUCCESS|OK|PASS))\b/i },
  { level: 'success', pattern: mobaWords(
    'accepted',
    'allowed',
    'enabled',
    'connected',
    'successfully',
    'successful',
    'succeeded',
    'success',
    // 多语言 success
    'erfolgreich',
    'exitoso',
    'successo',
    'sucedido',
    'framgångsrik',
  ) },
  { level: 'success', pattern: MOBA_ASSIGN_TRUE, group: 1 },

  // ── Info（蓝）──
  { level: 'info', pattern: /^\s*(INFO)\b/i },
  { level: 'info', pattern: /^\s*\[(INFO)\]/i },
  { level: 'info', pattern: /^\s*(DEBUG)\b/i },
  { level: 'info', pattern: /^\s*(NOTE)\b/i },
  { level: 'info', pattern: mobaWords(
    'launching',
    'checking',
    'loading',
    'creating',
    'building',
    'important',
    'booting',
    'starting',
    'notice',
    'informational',
    'information',
    'informations',
    'info',
    'note',
    // 多语言 info
    'informationen',
    'informazioni',
    'informação',
    'oplysninger',
    'información',
    'informasi',
  ) },
  { level: 'info', pattern: /\(((?:ii|!!))\)/i },
]

function stripAnsi(text: string): string {
  // CSI + OSC(简化) 兜底：足够应对常见 SGR / 光标控制序列
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
}

function toGlobalRegex(re: RegExp): RegExp {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  return new RegExp(re.source, flags)
}

function isOverlapping(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

export function getLogHighlightSpans(lineText: string): LogHighlightSpan[] {
  const plain = stripAnsi(lineText)
  const spans: LogHighlightSpan[] = []

  for (const check of LOG_HIGHLIGHT_CHECKS) {
    const re = toGlobalRegex(check.pattern)
    re.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = re.exec(plain)) !== null) {
      const groupIndex = check.group ?? 1
      const token = match[groupIndex] ?? match[0]
      if (!token) continue

      const tokenOffsetInMatch = match[0].indexOf(token)
      if (tokenOffsetInMatch < 0) continue

      const start = match.index + tokenOffsetInMatch
      const end = start + token.length
      if (end <= start) continue

      const candidate = { start, end }
      if (spans.some((s) => isOverlapping(s, candidate))) continue

      spans.push({
        start,
        end,
        level: check.level,
        color: LOG_HIGHLIGHT_COLORS[check.level],
      })
    }
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  return spans
}

export function detectLogHighlightLevel(lineText: string): LogHighlightLevel | null {
  const spans = getLogHighlightSpans(lineText)
  return spans.length > 0 ? spans[0].level : null
}
