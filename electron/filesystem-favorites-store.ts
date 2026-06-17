import { existsSync, readFileSync, writeFileSync } from 'fs'
import { stat } from 'fs/promises'
import { randomUUID } from 'crypto'
import { basename, normalize, resolve } from 'path'
import { ensureConfigDir, getFilesystemFavoritesFilePath } from './config-paths'
import {
  normalizeFilesystemFavorites,
  type FilesystemFavorite,
  type FilesystemFavoriteAddResult,
} from './shared/filesystem-favorites-types'

function compareFavoritePaths(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

export class FilesystemFavoritesStore {
  private favorites: FilesystemFavorite[] = []
  private filePath = getFilesystemFavoritesFilePath()

  load(): FilesystemFavorite[] {
    ensureConfigDir()
    this.filePath = getFilesystemFavoritesFilePath()
    if (!existsSync(this.filePath)) {
      this.favorites = []
      return this.favorites
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown
      this.favorites = normalizeFilesystemFavorites(raw)
    } catch {
      this.favorites = []
    }
    return this.favorites
  }

  get(): FilesystemFavorite[] {
    return this.favorites
  }

  private save(): FilesystemFavorite[] {
    ensureConfigDir()
    writeFileSync(
      this.filePath,
      JSON.stringify({ favorites: this.favorites }, null, 2),
      'utf-8',
    )
    return this.favorites
  }

  async add(path: string, displayName?: string): Promise<FilesystemFavoriteAddResult> {
    const trimmed = path.trim()
    if (!trimmed) return { ok: false, error: 'INVALID_PATH' }

    const normalized = normalize(resolve(trimmed))
    if (this.favorites.some((f) => compareFavoritePaths(f.path, normalized))) {
      return { ok: false, error: 'DUPLICATE' }
    }

    try {
      if (!existsSync(normalized)) return { ok: false, error: 'NOT_FOUND' }
      const st = await stat(normalized)
      if (!st.isDirectory()) return { ok: false, error: 'NOT_DIRECTORY' }
    } catch {
      return { ok: false, error: 'NOT_FOUND' }
    }

    const favorite: FilesystemFavorite = {
      id: randomUUID(),
      path: normalized,
      displayName: displayName?.trim() || basename(normalized) || normalized,
      addedAt: Date.now(),
    }
    this.favorites = [...this.favorites, favorite]
    this.save()
    return { ok: true, favorite }
  }

  remove(id: string): boolean {
    const trimmed = id.trim()
    if (!trimmed) return false
    const next = this.favorites.filter((f) => f.id !== trimmed)
    if (next.length === this.favorites.length) return false
    this.favorites = next
    this.save()
    return true
  }

  isFavoritePath(path: string): boolean {
    const trimmed = path.trim()
    if (!trimmed) return false
    return this.favorites.some((f) => compareFavoritePaths(f.path, trimmed))
  }
}
