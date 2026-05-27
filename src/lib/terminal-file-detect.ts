import type { PreviewSettings } from '../../electron/shared/preview-settings'
import {
  classifyTerminalPreviewFile,
  type TerminalPreviewFileKind,
} from '../../electron/shared/terminal-preview-files'

/** 文件名主体：允许中文等 Unicode，不含空格（无空格路径仍走此分支） */
const FILE_NAME_CHARS = '[^\\s"\'<>|*?/\\\\]+'

/**
 * 匹配终端行中的文件路径 token（不含空格）。
 * 含目录的相对路径须先于「以 / 开头的绝对路径」分支，避免 `dir/file.pdf` 被误匹配为 `/file.pdf`。
 */
const FILE_PATH_TOKEN = new RegExp(
  [
    // Windows 绝对路径（路径段可含空格）
    '[A-Za-z]:(?:[\\\\/][^"\'<>|*?]+)+',
    '\\.{0,2}[\\\\/][^\\s"\'<>|*?]+',
    `(?:${FILE_NAME_CHARS}[\\\\/])+${FILE_NAME_CHARS}\\.[A-Za-z0-9]{1,10}`,
    '\\/[^\\s"\'<>|*?]+',
    `${FILE_NAME_CHARS}\\.[A-Za-z0-9]{1,10}`,
  ].join('|'),
  'g',
)

/** 引号包裹的路径（可含空格） */
const QUOTED_PATH = /"([^"]+)"|'([^']+)'/g

/** 已知可预览扩展名，用于从扩展名反向定位含空格的文件名 */
const PREVIEW_EXTENSION_PATTERN =
  /\.(?:pdf|docx|xlsx|csv|txt|md|png|jpe?g|gif|webp|bmp|svg|ico|avif|[a-z0-9]{1,10})(?![a-z0-9])/gi

const TRAILING_PUNCT = /[.,;:!?)>\]}]+$/g
const PATH_STOP_CHARS = /[\t"'<>|*?]/

export interface TerminalFileMatch {
  path: string
  start: number
  end: number
  kind: TerminalPreviewFileKind
}

function joinCwdWithRelative(cwd: string, relative: string): string {
  const sep = cwd.includes('\\') ? '\\' : '/'
  const base = cwd.endsWith(sep) ? cwd.slice(0, -1) : cwd
  const normalized = relative.replace(/\//g, sep).replace(/\\/g, sep)
  const trimmed = normalized.replace(new RegExp(`^[${sep === '\\' ? '\\\\' : sep}]+`), '')
  return `${base}${sep}${trimmed}`
}

function stripTrailingPunct(token: string): string {
  return token.replace(TRAILING_PUNCT, '')
}

/** 从已知扩展名的 `.` 位置向前扫描路径起点，允许文件名/目录名中含空格 */
function findPathStartBeforeDot(line: string, dotIndex: number): number | null {
  if (dotIndex <= 0 || line[dotIndex] !== '.') return null
  let i = dotIndex - 1

  while (i >= 0) {
    const c = line[i]
    if (PATH_STOP_CHARS.test(c)) break

    if (c === ' ') {
      if (i > 0 && line[i - 1] === ' ') break

      const before = line.slice(0, i).trimEnd()
      if (before.length > 0) {
        const tokens = before.split(/\s+/)
        const lastToken = tokens[tokens.length - 1] ?? ''
        if (/^[\d,]+$/.test(lastToken)) break

        const beforeHasUnicode = /[^\x00-\x7F]/.test(before)
        const afterSpace = line.slice(i + 1, dotIndex)

        if (
          !beforeHasUnicode &&
          tokens.length === 1 &&
          /^[a-zA-Z@][a-zA-Z0-9_@%-]*$/.test(lastToken)
        ) {
          const afterHasUnicode = /[^\x00-\x7F]/.test(afterSpace)
          // `ls file.xlsx` 或 `ls 中文 file.xlsx`：左侧为单个 shell token 时截断
          if (!afterSpace.includes(' ') || afterHasUnicode) break
        }
      }
    }

    if (c === ':' && i === 1 && /[A-Za-z]/.test(line[i - 1])) {
      return 0
    }

    i--
  }

  return i + 1
}

function resolveTerminalFilePath(token: string, cwd?: string): string | null {
  const cleaned = stripTrailingPunct(token.trim())
  if (!cleaned || cleaned.length < 2) return null
  if (/^https?:\/\//i.test(cleaned)) return null

  const kind = classifyTerminalPreviewFile(cleaned)
  if (kind === 'none') return null

  if (/^[A-Za-z]:[\\/]/.test(cleaned) || cleaned.startsWith('\\\\')) {
    return cleaned
  }
  if (cleaned.startsWith('/') && !/^[A-Za-z]:/.test(cleaned)) {
    return cleaned
  }
  if (/^[\\/]/.test(cleaned) && cwd) {
    const sep = cwd.includes('\\') ? '\\' : '/'
    const base = cwd.endsWith(sep) ? cwd.slice(0, -1) : cwd
    return `${base}${cleaned.startsWith('\\') || cleaned.startsWith('/') ? '' : sep}${cleaned.replace(/^[/\\]/, '')}`
  }
  if (
    cwd &&
    !/^[A-Za-z]:/.test(cleaned) &&
    !cleaned.startsWith('/') &&
    !cleaned.startsWith('\\') &&
    (cleaned.includes('/') || cleaned.includes('\\'))
  ) {
    return joinCwdWithRelative(cwd, cleaned)
  }
  if (cwd && !cleaned.includes(':')) {
    const sep = cwd.includes('\\') ? '\\' : '/'
    const base = cwd.endsWith(sep) ? cwd.slice(0, -1) : cwd
    return `${base}${sep}${cleaned}`
  }
  return cleaned
}

function pushMatch(
  matches: TerminalFileMatch[],
  lineText: string,
  start: number,
  end: number,
  cwd?: string,
): void {
  if (start < 0 || end <= start || end > lineText.length) return
  const raw = lineText.slice(start, end)
  const resolved = resolveTerminalFilePath(raw, cwd)
  if (!resolved) return
  const kind = classifyTerminalPreviewFile(resolved)
  if (kind === 'none') return
  if (matches.some((m) => m.start === start && m.end === end)) return
  matches.push({ path: resolved, start, end, kind })
}

function findQuotedPathMatches(lineText: string, cwd?: string): TerminalFileMatch[] {
  const matches: TerminalFileMatch[] = []
  QUOTED_PATH.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = QUOTED_PATH.exec(lineText)) !== null) {
    const inner = m[1] ?? m[2] ?? ''
    if (!inner) continue
    const start = m.index + 1
    const end = m.index + m[0].length - 1
    pushMatch(matches, lineText, start, end, cwd)
  }
  return matches
}

function findExtensionAnchoredMatches(lineText: string, cwd?: string): TerminalFileMatch[] {
  const matches: TerminalFileMatch[] = []
  PREVIEW_EXTENSION_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PREVIEW_EXTENSION_PATTERN.exec(lineText)) !== null) {
    const dotIndex = m.index
    const start = findPathStartBeforeDot(lineText, dotIndex)
    if (start === null) continue
    const end = dotIndex + m[0].length
    pushMatch(matches, lineText, start, end, cwd)
  }
  return matches
}

function findRegexPathMatches(lineText: string, cwd?: string): TerminalFileMatch[] {
  const matches: TerminalFileMatch[] = []
  FILE_PATH_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FILE_PATH_TOKEN.exec(lineText)) !== null) {
    pushMatch(matches, lineText, m.index, m.index + m[0].length, cwd)
  }
  return matches
}

function mergeOverlappingMatches(matches: TerminalFileMatch[]): TerminalFileMatch[] {
  if (matches.length <= 1) return matches
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: TerminalFileMatch[] = []
  for (const match of sorted) {
    const last = merged[merged.length - 1]
    if (last && match.start >= last.start && match.end <= last.end) continue
    if (last && match.start < last.end) {
      if (match.end - match.start > last.end - last.start) {
        merged[merged.length - 1] = match
      }
      continue
    }
    merged.push(match)
  }
  return merged
}

export function findFileMatchesInLine(lineText: string, cwd?: string): TerminalFileMatch[] {
  const all = [
    ...findQuotedPathMatches(lineText, cwd),
    ...findExtensionAnchoredMatches(lineText, cwd),
    ...findRegexPathMatches(lineText, cwd),
  ]
  return mergeOverlappingMatches(all)
}

export function findFilePathAtColumn(
  lineText: string,
  col: number,
  cwd?: string,
): TerminalFileMatch | null {
  let best: TerminalFileMatch | null = null
  for (const match of findFileMatchesInLine(lineText, cwd)) {
    if (col < match.start || col >= match.end) continue
    if (!best || match.end - match.start > best.end - best.start) {
      best = match
    }
  }
  return best
}

export function lineTextHasPreviewableFile(
  lineText: string,
  preview: PreviewSettings,
  cwd?: string,
): boolean {
  return findFileMatchesInLine(lineText, cwd).some((m) =>
    isPreviewKindEnabled(m.kind, preview),
  )
}

export function isPreviewKindEnabled(
  kind: TerminalPreviewFileKind,
  preview: PreviewSettings,
): boolean {
  switch (kind) {
    case 'image':
      return preview.imagePreview
    case 'chart':
      return preview.chartPreview
    case 'any':
      return preview.anyFilePreview
    default:
      return false
  }
}

export function pickPreviewFileAtColumn(
  lineText: string,
  col: number,
  preview: PreviewSettings,
  cwd?: string,
): TerminalFileMatch | null {
  const match = findFilePathAtColumn(lineText, col, cwd)
  if (!match || !isPreviewKindEnabled(match.kind, preview)) return null
  return match
}
