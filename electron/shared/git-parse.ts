import { GIT_GRAPH_ROW_TYPE } from './repo-types'
import type { GitCommitDetail, GitGraphRow } from './repo-types'

export const GIT_RECORD_SEP = '\x1e'
export const GIT_FIELD_SEP = '\x1f'

function parseCommitType(parentCount: number): GitGraphRow['type'] {
  if (parentCount >= 2) return GIT_GRAPH_ROW_TYPE.merge
  return GIT_GRAPH_ROW_TYPE.commit
}

export function parseGraphLog(text: string, fieldSep = GIT_FIELD_SEP): GitGraphRow[] {
  const rows: GitGraphRow[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split(fieldSep)
    if (parts.length < 6) continue
    const [sha, parentsRaw, author, email, dateRaw, subject, body = ''] = parts
    const parents = parentsRaw ? parentsRaw.split(' ').filter(Boolean) : []
    const date = Number(dateRaw) * 1000
    if (!sha || !Number.isFinite(date)) continue
    const message = body ? `${subject}\n\n${body}`.trim() : subject
    rows.push({
      sha,
      parents,
      author,
      email,
      date,
      message,
      type: parseCommitType(parents.length),
    })
  }
  return rows
}

export function parseNameStatusLine(
  line: string,
): { status: GitCommitDetail['files'][0]['status']; path: string; oldPath?: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const tabParts = trimmed.split('\t')
  const code = tabParts[0] ?? ''
  if (code.startsWith('R') || code.startsWith('C')) {
    if (tabParts.length < 3) return null
    return {
      status: code.startsWith('R') ? 'renamed' : 'copied',
      oldPath: tabParts[1],
      path: tabParts[2]!,
    }
  }
  if (tabParts.length < 2) return null
  const path = tabParts[1]!
  switch (code) {
    case 'A':
      return { status: 'added', path }
    case 'D':
      return { status: 'deleted', path }
    case 'M':
      return { status: 'modified', path }
    default:
      return { status: 'unknown', path }
  }
}

export function parseNumstatLine(line: string): { path: string; additions: number; deletions: number } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
  if (!match) return null
  const [, addRaw, delRaw, filePath] = match
  return {
    path: filePath!,
    additions: addRaw === '-' ? 0 : Number(addRaw),
    deletions: delRaw === '-' ? 0 : Number(delRaw),
  }
}

export function parseCommitDetailFromShow(
  showStdout: string,
  numstatStdout: string,
  statusStdout: string,
  fieldSep = GIT_FIELD_SEP,
): GitCommitDetail | { error: 'PARSE_FAILED' } {
  const parts = showStdout.trim().split(fieldSep)
  if (parts.length < 6) return { error: 'PARSE_FAILED' }
  const [fullSha, shortSha, author, email, dateRaw, subject, body = '', parentsRaw = ''] = parts
  const date = Number(dateRaw) * 1000
  const parents = parentsRaw ? parentsRaw.split(' ').filter(Boolean) : []

  const statsByPath = new Map<string, { additions: number; deletions: number }>()
  for (const line of numstatStdout.split('\n')) {
    const parsed = parseNumstatLine(line)
    if (parsed) statsByPath.set(parsed.path, parsed)
  }

  const files: GitCommitDetail['files'] = []
  const seenPaths = new Set<string>()

  for (const line of statusStdout.split('\n')) {
    const parsed = parseNameStatusLine(line)
    if (!parsed) continue
    const stats = statsByPath.get(parsed.path)
    files.push({
      path: parsed.path,
      oldPath: parsed.oldPath,
      additions: stats?.additions ?? 0,
      deletions: stats?.deletions ?? 0,
      status: parsed.status,
    })
    seenPaths.add(parsed.path)
  }

  for (const [path, stats] of statsByPath) {
    if (seenPaths.has(path)) continue
    files.push({
      path,
      additions: stats.additions,
      deletions: stats.deletions,
      status: 'modified',
    })
  }

  return {
    sha: fullSha,
    shortSha,
    author,
    email,
    date,
    subject,
    body: body.trim(),
    parents,
    files,
  }
}
