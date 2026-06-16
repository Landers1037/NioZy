/** DevTools 过滤关键字: NioZy GitGraph */
import { devError, devLog, devWarn, isDevRuntime } from './dev-log'

const LOG_PREFIX = '[NioZy GitGraph]'

/** 开发模式默认开启；生产环境可 localStorage.setItem('niozy:git-graph-debug','1') 后刷新 */
export function isGitGraphDebugEnabled(): boolean {
  if (isDevRuntime()) return true
  try {
    if (typeof localStorage !== 'undefined') {
      const flag = localStorage.getItem('niozy:git-graph-debug')
      if (flag === '1') return true
      if (flag === '0') return false
    }
  } catch {
    // ignore
  }
  return false
}

export function gitGraphDebug(scope: string, message: string, detail?: unknown): void {
  if (!isGitGraphDebugEnabled()) return
  const label = `${LOG_PREFIX}[${scope}] ${message}`
  if (detail !== undefined) {
    devLog(label, detail)
  } else {
    devLog(label)
  }
}

export function gitGraphWarn(scope: string, message: string, detail?: unknown): void {
  if (!isGitGraphDebugEnabled()) return
  const label = `${LOG_PREFIX}[${scope}] ${message}`
  if (detail !== undefined) {
    devWarn(label, detail)
  } else {
    devWarn(label)
  }
}

export function gitGraphError(scope: string, message: string, detail?: unknown): void {
  if (!isGitGraphDebugEnabled()) return
  const label = `${LOG_PREFIX}[${scope}] ${message}`
  if (detail !== undefined) {
    devError(label, detail)
  } else {
    devError(label)
  }
}

export interface GraphRowsSummary {
  count: number
  typeCounts: Record<string, number>
  rowsWithHeads: number
  rowsWithRemotes: number
  rowsWithTags: number
  invalidTypeRows: number
  firstSha?: string
  lastSha?: string
}

export function summarizeGraphRows(
  rows: Array<{
    sha?: string
    type?: string
    heads?: unknown[]
    remotes?: unknown[]
    tags?: unknown[]
  }>,
): GraphRowsSummary {
  const typeCounts: Record<string, number> = {}
  let rowsWithHeads = 0
  let rowsWithRemotes = 0
  let rowsWithTags = 0
  let invalidTypeRows = 0
  const validTypes = new Set([
    'commit-node',
    'merge-node',
    'stash-node',
    'merge-conflict-node',
    'unsupported-rebase-warning-node',
    'work-dir-changes',
    'normal',
    'merge',
    'stash',
  ])

  for (const row of rows) {
    const type = row.type ?? '(missing)'
    typeCounts[type] = (typeCounts[type] ?? 0) + 1
    if (!validTypes.has(type)) invalidTypeRows++
    if (row.heads?.length) rowsWithHeads++
    if (row.remotes?.length) rowsWithRemotes++
    if (row.tags?.length) rowsWithTags++
  }

  return {
    count: rows.length,
    typeCounts,
    rowsWithHeads,
    rowsWithRemotes,
    rowsWithTags,
    invalidTypeRows,
    firstSha: rows[0]?.sha?.slice(0, 8),
    lastSha: rows[rows.length - 1]?.sha?.slice(0, 8),
  }
}
