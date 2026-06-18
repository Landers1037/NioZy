export interface ManagedRepo {
  id: string
  path: string
  displayName?: string
  addedAt: number
}

export interface RepoConfig {
  repos: ManagedRepo[]
}

export interface ManagedRepoSummary extends ManagedRepo {
  name: string
  branch: string | null
  lastCommitAt: number | null
  lastCommitMessage: string | null
  error?: string
}

export interface GitDetectResult {
  found: boolean
  path?: string
}

export interface GitRepoValidateResult {
  ok: boolean
  error?: 'NOT_GIT_REPO' | 'PATH_INVALID'
}

export interface GitPullResult {
  ok: boolean
  output?: string
  error?: string
}

export interface GitCloneParams {
  url: string
  branch: string
  targetPath: string
}

export interface GitCloneResult {
  ok: boolean
  error?: string
  repo?: ManagedRepo
}

export interface GitBranchInfo {
  name: string
  current: boolean
  remote: boolean
}

export interface GitCheckoutResult {
  ok: boolean
  error?: string
}

export interface GitGraphCursor {
  sha: string
  timestamp: number
}

export interface GitGraphHead {
  id: string
  name: string
  isCurrentHead?: boolean
}

export interface GitGraphRemote {
  id: string
  name: string
  owner?: string
}

export interface GitGraphTag {
  id: string
  name: string
  annotated?: boolean
}

/** 提交图行类型（用于图节点样式） */
export const GIT_GRAPH_ROW_TYPE = {
  commit: 'commit-node',
  merge: 'merge-node',
  stash: 'stash-node',
} as const

export type GitGraphRowType = (typeof GIT_GRAPH_ROW_TYPE)[keyof typeof GIT_GRAPH_ROW_TYPE]

export interface GitGraphRow {
  sha: string
  parents: string[]
  author: string
  email: string
  date: number
  message: string
  type: GitGraphRowType
  heads?: GitGraphHead[]
  remotes?: GitGraphRemote[]
  tags?: GitGraphTag[]
}

export interface GitGraphCommitsResult {
  rows: GitGraphRow[]
  hasMore: boolean
  cursor?: GitGraphCursor
}

export interface GitCommitFileChange {
  path: string
  oldPath?: string
  additions: number
  deletions: number
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown'
}

export interface GitCommitFileDiff {
  path: string
  diff: string
}

export interface GitCommitDetail {
  sha: string
  shortSha: string
  author: string
  email: string
  date: number
  subject: string
  body: string
  parents: string[]
  files: GitCommitFileChange[]
}

export function normalizeManagedRepo(value: unknown): ManagedRepo | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Partial<ManagedRepo>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const path = typeof o.path === 'string' ? o.path.trim() : ''
  if (!id || !path) return null
  const addedAt = typeof o.addedAt === 'number' && Number.isFinite(o.addedAt) ? o.addedAt : Date.now()
  const displayName =
    typeof o.displayName === 'string' && o.displayName.trim() ? o.displayName.trim() : undefined
  return { id, path, displayName, addedAt }
}

export function normalizeRepoConfig(value: unknown): RepoConfig {
  if (!value || typeof value !== 'object') return { repos: [] }
  const list = (value as { repos?: unknown }).repos
  if (!Array.isArray(list)) return { repos: [] }
  return {
    repos: list.map(normalizeManagedRepo).filter((x): x is ManagedRepo => x != null),
  }
}
