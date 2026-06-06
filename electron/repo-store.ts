import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { basename, resolve } from 'path'
import type { ManagedRepo, RepoConfig } from './shared/repo-types'
import { normalizeRepoConfig } from './shared/repo-types'
import { ensureConfigDir, getRepoFilePath } from './config-paths'

export class RepoStore {
  private repos: ManagedRepo[] = []
  private filePath = getRepoFilePath()

  load(): ManagedRepo[] {
    ensureConfigDir()
    this.filePath = getRepoFilePath()
    if (!existsSync(this.filePath)) {
      this.repos = []
      return this.repos
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<RepoConfig>
      this.repos = normalizeRepoConfig(raw).repos
    } catch {
      this.repos = []
    }
    return this.repos
  }

  get(): ManagedRepo[] {
    return this.repos
  }

  private save(): ManagedRepo[] {
    ensureConfigDir()
    writeFileSync(this.filePath, JSON.stringify({ repos: this.repos }, null, 2), 'utf-8')
    return this.repos
  }

  add(path: string, displayName?: string): { ok: true; repo: ManagedRepo } | { ok: false; error: 'DUPLICATE' } {
    const normalized = resolve(path)
    if (this.repos.some((r) => resolve(r.path).toLowerCase() === normalized.toLowerCase())) {
      return { ok: false, error: 'DUPLICATE' }
    }
    const repo: ManagedRepo = {
      id: randomUUID(),
      path: normalized,
      displayName: displayName?.trim() || basename(normalized),
      addedAt: Date.now(),
    }
    this.repos = [...this.repos, repo]
    this.save()
    return { ok: true, repo }
  }

  remove(id: string): boolean {
    const next = this.repos.filter((r) => r.id !== id)
    if (next.length === this.repos.length) return false
    this.repos = next
    this.save()
    return true
  }

  findById(id: string): ManagedRepo | undefined {
    return this.repos.find((r) => r.id === id)
  }
}
