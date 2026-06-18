import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { basename, join, resolve } from 'path'
import type { BrowserWindow } from 'electron'
import { dialog } from 'electron'
import { resolveExecutable } from './resolve-executable'
import { GIT_GRAPH_ROW_TYPE } from './shared/repo-types'
import { isValidGitCloneUrl } from './shared/git-url'
import { gitGraphDebug, summarizeGraphRows } from './shared/git-graph-debug'
import type {
  GitBranchInfo,
  GitCheckoutResult,
  GitCloneParams,
  GitCloneResult,
  GitCommitDetail,
  GitCommitFileDiff,
  GitDetectResult,
  GitGraphCommitsResult,
  GitGraphCursor,
  GitGraphHead,
  GitGraphRemote,
  GitGraphRow,
  GitGraphTag,
  GitPullResult,
  GitRepoValidateResult,
  ManagedRepoSummary,
} from './shared/repo-types'
import { RepoStore } from './repo-store'

const GRAPH_PAGE_SIZE = 100
const RECORD_SEP = '\x1e'
const FIELD_SEP = '\x1f'

function runGitStreaming(
  gitPath: string,
  args: string[],
  onOutput: (chunk: string) => void,
  cwd?: string,
): Promise<{ ok: true; stdout: string; stderr: string } | { ok: false; error: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(gitPath, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let stdout = ''
    let stderr = ''
    const emit = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      if (text) onOutput(text)
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
      emit(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      emit(chunk)
    })
    child.on('error', (err) => {
      resolvePromise({ ok: false, error: err.message })
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ ok: true, stdout, stderr })
      } else {
        const msg = stderr.trim() || stdout.trim() || `git exited with code ${code}`
        resolvePromise({ ok: false, error: msg })
      }
    })
  })
}

function runGit(
  gitPath: string,
  args: string[],
  cwd?: string,
): Promise<{ ok: true; stdout: string; stderr: string } | { ok: false; error: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(gitPath, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      resolvePromise({ ok: false, error: err.message })
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ ok: true, stdout, stderr })
      } else {
        const msg = stderr.trim() || stdout.trim() || `git exited with code ${code}`
        resolvePromise({ ok: false, error: msg })
      }
    })
  })
}

async function resolveCurrentBranch(gitPath: string, repoPath: string): Promise<string | null> {
  const showCurrent = await runGit(gitPath, ['branch', '--show-current'], repoPath)
  if (showCurrent.ok) {
    const name = showCurrent.stdout.trim()
    if (name) return name
  }

  const abbrev = await runGit(gitPath, ['rev-parse', '--abbrev-ref', 'HEAD'], repoPath)
  if (abbrev.ok) {
    const name = abbrev.stdout.trim()
    if (name && name !== 'HEAD') return name
  }

  const symbolic = await runGit(gitPath, ['symbolic-ref', '--short', 'HEAD'], repoPath)
  if (symbolic.ok) {
    const name = symbolic.stdout.trim()
    if (name) return name
  }

  const describe = await runGit(gitPath, ['describe', '--all', '--exact-match', 'HEAD'], repoPath)
  if (describe.ok) {
    const raw = describe.stdout.trim()
    if (raw.startsWith('heads/')) return raw.slice('heads/'.length)
    if (raw.startsWith('remotes/')) return raw.slice('remotes/'.length)
    if (raw) return raw
  }

  return null
}

function sortBranches(a: GitBranchInfo, b: GitBranchInfo): number {
  if (a.remote !== b.remote) return a.remote ? 1 : -1
  return a.name.localeCompare(b.name)
}

function parseNameStatusLine(line: string): { status: GitCommitDetail['files'][0]['status']; path: string; oldPath?: string } | null {
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

function parseNumstatLine(line: string): { path: string; additions: number; deletions: number } | null {
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
function parseCommitType(parentCount: number): GitGraphRow['type'] {
  if (parentCount >= 2) return GIT_GRAPH_ROW_TYPE.merge
  return GIT_GRAPH_ROW_TYPE.commit
}

function parseGraphLog(text: string): GitGraphRow[] {
  const rows: GitGraphRow[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split(FIELD_SEP)
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

export class GitService {
  private repoStore = new RepoStore()
  private customGitPath = ''

  constructor() {
    this.repoStore.load()
  }

  setGitPath(path: string): void {
    this.customGitPath = path.trim()
  }

  resolveGitPath(): string | null {
    const configured = this.customGitPath.trim()
    if (configured) {
      if (existsSync(configured)) return configured
      const resolved = resolveExecutable(configured)
      if (resolved) return resolved
    }
    return resolveExecutable('git')
  }

  async detectGit(): Promise<GitDetectResult> {
    const path = this.resolveGitPath()
    if (!path) return { found: false }
    const result = await runGit(path, ['--version'])
    if (!result.ok) return { found: false }
    return { found: true, path }
  }

  validateRepo(repoPath: string): GitRepoValidateResult {
    const normalized = resolve(repoPath)
    if (!normalized) return { ok: false, error: 'PATH_INVALID' }
    if (!existsSync(join(normalized, '.git'))) {
      return { ok: false, error: 'NOT_GIT_REPO' }
    }
    return { ok: true }
  }

  async pickDirectory(mainWindow: BrowserWindow | null): Promise<string | null> {
    const openOptions = {
      title: '选择 Git 仓库目录',
      properties: ['openDirectory'] as ('openDirectory')[],
    }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || !filePaths[0]) return null
    return resolve(filePaths[0])
  }

  async pickParentDirectory(mainWindow: BrowserWindow | null): Promise<string | null> {
    const openOptions = {
      title: '选择本地存储目录',
      properties: ['openDirectory'] as ('openDirectory')[],
    }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || !filePaths[0]) return null
    return resolve(filePaths[0])
  }

  addRepo(path: string) {
    const validation = this.validateRepo(path)
    if (!validation.ok) return validation
    return this.repoStore.add(path)
  }

  removeRepo(id: string): boolean {
    return this.repoStore.remove(id)
  }

  getRepo(id: string) {
    return this.repoStore.findById(id)
  }

  private async queryRepoSummary(
    gitPath: string,
    repo: { id: string; path: string; displayName?: string; addedAt: number },
  ): Promise<ManagedRepoSummary> {
    const name = repo.displayName || basename(repo.path)
    const base: ManagedRepoSummary = {
      ...repo,
      name,
      branch: null,
      lastCommitAt: null,
      lastCommitMessage: null,
    }
    const validation = this.validateRepo(repo.path)
    if (!validation.ok) {
      return {
        ...base,
        error: validation.error === 'NOT_GIT_REPO' ? 'NOT_GIT_REPO' : 'PATH_INVALID',
      }
    }
    const branch = await resolveCurrentBranch(gitPath, repo.path)
    const logResult = await runGit(gitPath, ['log', '-1', '--format=%ct%x1f%s'], repo.path)
    if (!branch && !logResult.ok) {
      return { ...base, error: logResult.error }
    }
    let lastCommitAt: number | null = null
    let lastCommitMessage: string | null = null
    if (logResult.ok && logResult.stdout.includes(FIELD_SEP)) {
      const [ts, subject] = logResult.stdout.trim().split(FIELD_SEP)
      const n = Number(ts)
      if (Number.isFinite(n)) lastCommitAt = n * 1000
      lastCommitMessage = subject?.trim() || null
    }
    return { ...base, branch, lastCommitAt, lastCommitMessage }
  }

  async listManaged(): Promise<ManagedRepoSummary[]> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) {
      return this.repoStore.get().map((repo) => ({
        ...repo,
        name: repo.displayName || basename(repo.path),
        branch: null,
        lastCommitAt: null,
        lastCommitMessage: null,
        error: 'GIT_NOT_FOUND',
      }))
    }
    const repos = this.repoStore.get()
    return Promise.all(repos.map((repo) => this.queryRepoSummary(gitPath, repo)))
  }

  async pull(repoId: string): Promise<GitPullResult> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { ok: false, error: 'REPO_NOT_FOUND' }
    const result = await runGit(gitPath, ['pull'], repo.path)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, output: result.stdout.trim() || result.stderr.trim() }
  }

  async clone(
    params: GitCloneParams,
    onOutput: (chunk: string) => void,
  ): Promise<GitCloneResult> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }

    const url = params.url.trim()
    const branch = params.branch.trim() || 'master'
    const targetPath = resolve(params.targetPath.trim())

    if (!isValidGitCloneUrl(url)) {
      return { ok: false, error: 'INVALID_URL' }
    }
    if (!targetPath) {
      return { ok: false, error: 'PATH_INVALID' }
    }
    if (existsSync(targetPath)) {
      return { ok: false, error: 'PATH_EXISTS' }
    }

    const args = ['clone', '--progress', '--branch', branch, url, targetPath]
    const result = await runGitStreaming(gitPath, args, onOutput)
    if (!result.ok) return { ok: false, error: result.error }

    const validation = this.validateRepo(targetPath)
    if (!validation.ok) return { ok: false, error: validation.error ?? 'NOT_GIT_REPO' }

    const addResult = this.repoStore.add(targetPath)
    if (!addResult.ok) {
      if (addResult.error === 'DUPLICATE') {
        const existing = this.repoStore
          .get()
          .find((r) => resolve(r.path).toLowerCase() === targetPath.toLowerCase())
        return { ok: true, repo: existing }
      }
      return { ok: false, error: addResult.error }
    }
    return { ok: true, repo: addResult.repo }
  }

  async listBranches(repoId: string): Promise<GitBranchInfo[] | { error: string }> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { error: 'REPO_NOT_FOUND' }

    const currentBranch = await resolveCurrentBranch(gitPath, repo.path)
    const result = await runGit(
      gitPath,
      [
        'for-each-ref',
        '--sort=-committerdate',
        '--format=%(refname:short)|%(refname)',
        'refs/heads/',
        'refs/remotes/',
      ],
      repo.path,
    )
    if (!result.ok) return { error: result.error }

    const branches: GitBranchInfo[] = []
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [shortName, refname] = trimmed.split('|')
      if (!shortName || !refname) continue
      if (refname.endsWith('/HEAD')) continue
      const remote = refname.startsWith('refs/remotes/')
      branches.push({
        name: shortName,
        current: currentBranch != null && shortName === currentBranch,
        remote,
      })
    }
    branches.sort(sortBranches)
    return branches
  }

  async checkout(repoId: string, branch: string): Promise<GitCheckoutResult> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { ok: false, error: 'REPO_NOT_FOUND' }

    const localRef = `refs/heads/${branch}`
    const remoteRef = `refs/remotes/${branch}`

    const localExists = await runGit(gitPath, ['show-ref', '--verify', localRef], repo.path)
    if (localExists.ok) {
      const switched = await runGit(gitPath, ['switch', branch], repo.path)
      if (switched.ok) return { ok: true }
      const checkedOut = await runGit(gitPath, ['checkout', branch], repo.path)
      return checkedOut.ok
        ? { ok: true }
        : { ok: false, error: checkedOut.error || switched.error }
    }

    const remoteExists = await runGit(gitPath, ['show-ref', '--verify', remoteRef], repo.path)
    if (remoteExists.ok) {
      const slash = branch.indexOf('/')
      const localName = slash >= 0 ? branch.slice(slash + 1) : branch

      if (localName !== branch) {
        const trackingExists = await runGit(
          gitPath,
          ['show-ref', '--verify', `refs/heads/${localName}`],
          repo.path,
        )
        if (trackingExists.ok) {
          const switched = await runGit(gitPath, ['switch', localName], repo.path)
          if (switched.ok) return { ok: true }
        }
      }

      let created = await runGit(gitPath, ['switch', '--track', branch], repo.path)
      if (created.ok) return { ok: true }

      created = await runGit(gitPath, ['switch', '-c', localName, '--track', branch], repo.path)
      if (created.ok) return { ok: true }

      const checkedOut = await runGit(
        gitPath,
        ['checkout', '-b', localName, '--track', branch],
        repo.path,
      )
      return checkedOut.ok
        ? { ok: true }
        : { ok: false, error: checkedOut.error || created.error }
    }

    const switched = await runGit(gitPath, ['switch', branch], repo.path)
    if (switched.ok) return { ok: true }
    const checkedOut = await runGit(gitPath, ['checkout', branch], repo.path)
    return checkedOut.ok
      ? { ok: true }
      : { ok: false, error: checkedOut.error || switched.error }
  }

  private async loadRefs(
    gitPath: string,
    repoPath: string,
  ): Promise<Map<string, { heads: GitGraphHead[]; remotes: GitGraphRemote[]; tags: GitGraphTag[] }>> {
    const map = new Map<
      string,
      { heads: GitGraphHead[]; remotes: GitGraphRemote[]; tags: GitGraphTag[] }
    >()
    const result = await runGit(
      gitPath,
      ['for-each-ref', '--format=%(objectname)|%(refname)|%(refname:short)'],
      repoPath,
    )
    if (!result.ok) return map

    const headResult = await runGit(gitPath, ['symbolic-ref', 'HEAD'], repoPath)
    const currentHeadRef = headResult.ok ? headResult.stdout.trim() : ''

    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [sha, fullName, shortName] = trimmed.split('|')
      if (!sha || !fullName || !shortName) continue
      if (!map.has(sha)) map.set(sha, { heads: [], remotes: [], tags: [] })
      const entry = map.get(sha)!
      if (fullName.startsWith('refs/heads/')) {
        entry.heads.push({
          id: fullName,
          name: shortName,
          isCurrentHead: fullName === currentHeadRef,
        })
      } else if (fullName.startsWith('refs/remotes/')) {
        const parts = shortName.split('/')
        entry.remotes.push({
          id: fullName,
          name: shortName,
          owner: parts.length > 1 ? parts[0] : undefined,
        })
      } else if (fullName.startsWith('refs/tags/')) {
        entry.tags.push({ id: fullName, name: shortName })
      }
    }
    return map
  }

  async getGraphCommits(
    repoId: string,
    cursor?: GitGraphCursor,
  ): Promise<GitGraphCommitsResult | { error: string }> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { error: 'REPO_NOT_FOUND' }

    const format = ['%H', '%P', '%an', '%ae', '%ct', '%s', '%b'].join(FIELD_SEP)

    const args = [
      'log',
      `--pretty=format:${format}${RECORD_SEP}`,
      '-n',
      String(GRAPH_PAGE_SIZE + 1),
      '--topo-order',
      '--all',
    ]

    if (cursor?.timestamp) {
      const untilSec = Math.floor(cursor.timestamp / 1000) + 1
      args.push(`--until=${untilSec}`)
    }

    const result = await runGit(gitPath, args, repo.path)
    if (!result.ok) return { error: result.error }

    let parsed = parseGraphLog(result.stdout.replaceAll(RECORD_SEP, '\n'))
    if (cursor?.sha) {
      parsed = parsed.filter((row) => row.sha !== cursor.sha)
    }

    const hasMore = parsed.length > GRAPH_PAGE_SIZE
    const rows = parsed.slice(0, GRAPH_PAGE_SIZE)
    const refs = await this.loadRefs(gitPath, repo.path)

    for (const row of rows) {
      const refData = refs.get(row.sha)
      row.heads = refData?.heads ?? []
      row.remotes = refData?.remotes ?? []
      row.tags = refData?.tags ?? []
    }

    const last = rows[rows.length - 1]
    const payload = {
      rows,
      hasMore,
      cursor: last ? { sha: last.sha, timestamp: last.date } : cursor,
    }
    gitGraphDebug('main', 'getGraphCommits', {
      repoId,
      repoPath: repo.path,
      cursor: cursor ?? null,
      summary: summarizeGraphRows(rows),
      hasMore,
      nextCursor: payload.cursor ?? null,
    })
    return payload
  }

  async getCommitDetail(repoId: string, sha: string): Promise<GitCommitDetail | { error: string }> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { error: 'REPO_NOT_FOUND' }

    const showResult = await runGit(
      gitPath,
      ['show', '-s', '--format=%H%x1f%h%x1f%an%x1f%ae%x1f%ct%x1f%s%x1f%b%x1f%P', sha],
      repo.path,
    )
    if (!showResult.ok) return { error: showResult.error }

    const parts = showResult.stdout.trim().split(FIELD_SEP)
    if (parts.length < 6) return { error: 'PARSE_FAILED' }
    const [fullSha, shortSha, author, email, dateRaw, subject, body = '', parentsRaw = ''] = parts
    const date = Number(dateRaw) * 1000
    const parents = parentsRaw ? parentsRaw.split(' ').filter(Boolean) : []

    const statResult = await runGit(gitPath, ['show', '--numstat', '--format=', sha], repo.path)
    const statusResult = await runGit(gitPath, ['show', '--name-status', '--format=', sha], repo.path)

    const statsByPath = new Map<string, { additions: number; deletions: number }>()
    if (statResult.ok) {
      for (const line of statResult.stdout.split('\n')) {
        const parsed = parseNumstatLine(line)
        if (parsed) statsByPath.set(parsed.path, parsed)
      }
    }

    const files: GitCommitDetail['files'] = []
    const seenPaths = new Set<string>()

    if (statusResult.ok) {
      for (const line of statusResult.stdout.split('\n')) {
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

  async getCommitFileDiff(
    repoId: string,
    sha: string,
    filePath: string,
  ): Promise<GitCommitFileDiff | { error: string }> {
    const gitPath = this.resolveGitPath()
    if (!gitPath) return { error: 'GIT_NOT_FOUND' }
    const repo = this.repoStore.findById(repoId)
    if (!repo) return { error: 'REPO_NOT_FOUND' }
    if (!filePath.trim()) return { error: 'PATH_INVALID' }

    const diffResult = await runGit(
      gitPath,
      ['show', '--no-color', '--format=', sha, '--', filePath],
      repo.path,
    )
    if (!diffResult.ok) return { error: diffResult.error }

    return {
      path: filePath,
      diff: diffResult.stdout.trimEnd(),
    }
  }
}
