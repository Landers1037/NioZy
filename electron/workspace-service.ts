import { readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, normalize, relative, resolve, sep } from 'path'
import type { BrowserWindow } from 'electron'
import { dialog } from 'electron'
import type { GitService } from './git-service'
import type {
  WorkspaceDetectGitResponse,
  WorkspaceDirEntry,
  WorkspaceGitDiffResponse,
  WorkspaceGitFile,
  WorkspaceGitFileStatus,
  WorkspaceGitStatusResponse,
  WorkspaceListDirResponse,
} from './shared/workspace-types'

/** Git 在 core.quotepath=true 时会把非 ASCII 路径转成八进制转义，需解码 */
function unquoteGitPath(raw: string): string {
  let path = raw.trim()
  if (path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1)
  }
  if (!/\\[0-7tn\\"]/.test(path)) return path

  const bytes: number[] = []
  for (let i = 0; i < path.length; ) {
    if (path[i] === '\\' && i + 1 < path.length) {
      const next = path[i + 1]!
      if (next >= '0' && next <= '7') {
        let oct = next
        if (i + 2 < path.length && path[i + 2]! >= '0' && path[i + 2]! <= '7') {
          oct += path[i + 2]!
          if (i + 3 < path.length && path[i + 3]! >= '0' && path[i + 3]! <= '7') {
            oct += path[i + 3]!
            bytes.push(parseInt(oct, 8))
            i += 4
            continue
          }
          bytes.push(parseInt(oct, 8))
          i += 3
          continue
        }
        bytes.push(parseInt(oct, 8))
        i += 2
        continue
      }
      if (next === 'n') {
        bytes.push(10)
        i += 2
        continue
      }
      if (next === 't') {
        bytes.push(9)
        i += 2
        continue
      }
      if (next === '\\') {
        bytes.push(92)
        i += 2
        continue
      }
      if (next === '"') {
        bytes.push(34)
        i += 2
        continue
      }
    }
    bytes.push(path.charCodeAt(i)!)
    i += 1
  }
  return Buffer.from(bytes).toString('utf8')
}

function isPathInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel !== '..' && !rel.startsWith(`..${sep}`) && rel !== ''
}

function buildAddedFileDiff(filePath: string, content: string): string {
  if (content === '') {
    return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +0,0 @@\n`
  }
  const normalized = content.endsWith('\n') ? content.slice(0, -1) : content
  const lines = normalized === '' ? [''] : normalized.split('\n')
  const body = lines.map((line) => `+${line}`).join('\n')
  return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${body}\n`
}

function parseGitStatusLine(line: string): { status: WorkspaceGitFileStatus; path: string } | null {
  if (line.length < 4) return null
  const indexStatus = line[0]
  const workTreeStatus = line[1]
  const statusChar = workTreeStatus !== ' ' && workTreeStatus !== '?' ? workTreeStatus : indexStatus
  const rawPath = line.slice(3).trim()
  if (!rawPath) return null

  let path = rawPath
  if (rawPath.includes(' -> ')) {
    path = rawPath.split(' -> ').pop()?.trim() ?? rawPath
  }
  path = unquoteGitPath(path)

  if (statusChar === '?' || statusChar === 'A') return { status: 'added', path }
  if (statusChar === 'D') return { status: 'deleted', path }
  if (statusChar === 'M' || statusChar === 'R' || statusChar === 'C' || statusChar === 'T') {
    return { status: 'modified', path }
  }
  return { status: 'modified', path }
}

async function runGit(
  gitPath: string,
  args: string[],
  cwd: string,
): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  const { spawn } = await import('child_process')
  return new Promise((resolvePromise) => {
    const child = spawn(gitPath, ['-c', 'core.quotepath=false', ...args], {
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
        resolvePromise({ ok: true, stdout })
      } else {
        const msg = stderr.trim() || stdout.trim() || `git exited with code ${code}`
        resolvePromise({ ok: false, error: msg })
      }
    })
  })
}

export class WorkspaceService {
  constructor(private readonly gitService: GitService) {}

  async listDir(dirPath: string): Promise<WorkspaceListDirResponse> {
    try {
      const resolved = normalize(dirPath || homedir())
      const names = await readdir(resolved)
      const entries: WorkspaceDirEntry[] = []
      for (const name of names) {
        if (name === '.' || name === '..') continue
        const full = join(resolved, name)
        try {
          const st = await stat(full)
          entries.push({
            name,
            path: full,
            isDirectory: st.isDirectory(),
            size: st.isFile() ? st.size : undefined,
            mtimeMs: st.mtimeMs,
          })
        } catch {
          /* skip inaccessible */
        }
      }
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      return { ok: true, entries }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async pickDirectory(mainWindow: BrowserWindow | null): Promise<string | null> {
    const openOptions = {
      title: '选择工作区目录',
      properties: ['openDirectory'] as ('openDirectory')[],
    }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || !filePaths[0]) return null
    return resolve(filePaths[0])
  }

  getHomeDir(): string {
    return homedir()
  }

  async detectGit(workDir: string): Promise<WorkspaceDetectGitResponse> {
    const gitPath = this.gitService.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }
    const normalized = resolve(workDir)
    if (!existsSync(join(normalized, '.git'))) {
      return { ok: true, isRepo: false }
    }
    const result = await runGit(gitPath, ['rev-parse', '--is-inside-work-tree'], normalized)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, isRepo: result.stdout.trim() === 'true' }
  }

  async gitStatus(workDir: string): Promise<WorkspaceGitStatusResponse> {
    const gitPath = this.gitService.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }
    const normalized = resolve(workDir)
    if (!existsSync(join(normalized, '.git'))) {
      return { ok: false, error: 'NOT_GIT_REPO' }
    }

    const statusResult = await runGit(
      gitPath,
      ['status', '--porcelain', '-uall'],
      normalized,
    )
    if (!statusResult.ok) return { ok: false, error: statusResult.error }

    const numstatResult = await runGit(
      gitPath,
      ['diff', '--numstat', 'HEAD'],
      normalized,
    )
    const stagedNumstat = await runGit(gitPath, ['diff', '--cached', '--numstat'], normalized)

    const numstatMap = new Map<string, { additions: number; deletions: number }>()
    const mergeNumstat = (stdout: string) => {
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        const [add, del, ...rest] = line.split('\t')
        const filePath = unquoteGitPath(rest.join('\t').trim())
        if (!filePath) continue
        const additions = Number(add) || 0
        const deletions = Number(del) || 0
        const existing = numstatMap.get(filePath)
        if (existing) {
          existing.additions += additions
          existing.deletions += deletions
        } else {
          numstatMap.set(filePath, { additions, deletions })
        }
      }
    }
    if (numstatResult.ok) mergeNumstat(numstatResult.stdout)
    if (stagedNumstat.ok) mergeNumstat(stagedNumstat.stdout)

    const files: WorkspaceGitFile[] = []
    const seen = new Set<string>()
    for (const line of statusResult.stdout.split('\n')) {
      if (!line.trim()) continue
      const parsed = parseGitStatusLine(line)
      if (!parsed || seen.has(parsed.path)) continue
      seen.add(parsed.path)
      const stats = numstatMap.get(parsed.path) ?? { additions: 0, deletions: 0 }
      files.push({
        path: parsed.path,
        status: parsed.status,
        additions: stats.additions,
        deletions: stats.deletions,
      })
    }

    return { ok: true, files }
  }

  async gitDiff(workDir: string, filePath: string): Promise<WorkspaceGitDiffResponse> {
    const gitPath = this.gitService.resolveGitPath()
    if (!gitPath) return { ok: false, error: 'GIT_NOT_FOUND' }
    const normalized = resolve(workDir)
    const quotedPath = unquoteGitPath(filePath)

    let result = await runGit(gitPath, ['diff', '--no-color', '--', quotedPath], normalized)
    if (result.ok && result.stdout.trim()) {
      return { ok: true, diff: result.stdout.trimEnd() }
    }

    result = await runGit(gitPath, ['diff', '--cached', '--no-color', '--', quotedPath], normalized)
    if (result.ok && result.stdout.trim()) {
      return { ok: true, diff: result.stdout.trimEnd() }
    }

    const statusLine = await runGit(
      gitPath,
      ['status', '--porcelain', '-uall', '--', quotedPath],
      normalized,
    )
    const parsed =
      statusLine.ok && statusLine.stdout.trim()
        ? parseGitStatusLine(statusLine.stdout.split('\n').find((l) => l.trim()) ?? '')
        : null

    if (parsed?.status === 'added') {
      const staged = await runGit(gitPath, ['show', '--no-color', `:0:${quotedPath}`], normalized)
      if (staged.ok && staged.stdout.length > 0) {
        return { ok: true, diff: buildAddedFileDiff(quotedPath, staged.stdout) }
      }

      const fullPath = resolve(normalized, quotedPath)
      if (isPathInside(normalized, fullPath) && existsSync(fullPath)) {
        try {
          const content = await readFile(fullPath, 'utf8')
          return { ok: true, diff: buildAddedFileDiff(quotedPath, content) }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return { ok: false, error: message }
        }
      }
    }

    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, diff: result.stdout.trimEnd() }
  }
}
