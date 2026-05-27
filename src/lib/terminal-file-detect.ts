import type { PreviewSettings } from '../../electron/shared/preview-settings'
import {
  classifyTerminalPreviewFile,
  type TerminalPreviewFileKind,
} from '../../electron/shared/terminal-preview-files'

/** 匹配 ls / 命令输出中的文件路径 token */
const FILE_PATH_TOKEN =
  /(?:[A-Za-z]:[\\/][^\s"'<>|*?]+|\.{0,2}[\\/][^\s"'<>|*?]+|\/[^\s"'<>|*?]+|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,10})/g

const TRAILING_PUNCT = /[.,;:!?)>\]}]+$/g

export interface TerminalFileMatch {
  path: string
  start: number
  end: number
  kind: TerminalPreviewFileKind
}

function stripTrailingPunct(token: string): string {
  return token.replace(TRAILING_PUNCT, '')
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
  if (cwd && !cleaned.includes(':')) {
    const sep = cwd.includes('\\') ? '\\' : '/'
    const base = cwd.endsWith(sep) ? cwd.slice(0, -1) : cwd
    return `${base}${sep}${cleaned}`
  }
  return cleaned
}

export function findFileMatchesInLine(lineText: string, cwd?: string): TerminalFileMatch[] {
  const matches: TerminalFileMatch[] = []
  FILE_PATH_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FILE_PATH_TOKEN.exec(lineText)) !== null) {
    const raw = m[0]
    const resolved = resolveTerminalFilePath(raw, cwd)
    if (!resolved) continue
    const kind = classifyTerminalPreviewFile(resolved)
    if (kind === 'none') continue
    matches.push({
      path: resolved,
      start: m.index,
      end: m.index + raw.length,
      kind,
    })
  }
  return matches
}

export function findFilePathAtColumn(
  lineText: string,
  col: number,
  cwd?: string,
): TerminalFileMatch | null {
  for (const match of findFileMatchesInLine(lineText, cwd)) {
    if (col >= match.start && col < match.end) return match
  }
  return null
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
