export interface FilesystemFavorite {
  id: string
  path: string
  displayName: string
  addedAt: number
}

export type FilesystemFavoriteAddError = 'DUPLICATE' | 'NOT_FOUND' | 'NOT_DIRECTORY' | 'INVALID_PATH'

export type FilesystemFavoriteAddResult =
  | { ok: true; favorite: FilesystemFavorite }
  | { ok: false; error: FilesystemFavoriteAddError }

export interface FilesystemFavoritesConfig {
  favorites: FilesystemFavorite[]
}

export function normalizeFilesystemFavorites(value: unknown): FilesystemFavorite[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const raw = value as Partial<FilesystemFavoritesConfig>
  if (!Array.isArray(raw.favorites)) return []

  const out: FilesystemFavorite[] = []
  for (const item of raw.favorites) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const fav = item as Partial<FilesystemFavorite>
    const id = typeof fav.id === 'string' ? fav.id.trim() : ''
    const path = typeof fav.path === 'string' ? fav.path.trim() : ''
    if (!id || !path) continue
    out.push({
      id,
      path,
      displayName:
        typeof fav.displayName === 'string' && fav.displayName.trim()
          ? fav.displayName.trim()
          : path,
      addedAt: typeof fav.addedAt === 'number' && Number.isFinite(fav.addedAt) ? fav.addedAt : 0,
    })
  }
  return out
}
