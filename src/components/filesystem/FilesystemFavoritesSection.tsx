import { useTranslation } from 'react-i18next'
import { Folder, Star } from 'lucide-react'
import { FilesystemEntryContextMenu } from '@/components/filesystem/FilesystemEntryContextMenu'
import type {
  FilesystemCustomOpener,
  FilesystemSettings,
} from '../../../electron/shared/filesystem-settings'
import type { FilesystemFavorite } from '../../../electron/shared/filesystem-favorites-types'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { cn } from '@/lib/utils'

function favoriteToEntry(favorite: FilesystemFavorite): ScpFileEntry {
  return {
    name: favorite.displayName,
    path: favorite.path,
    isDirectory: true,
  }
}

interface FilesystemFavoritesSectionProps {
  favorites: FilesystemFavorite[]
  selectedPath: string | null
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  onSelect: (path: string) => void
  onRemoveFavorite: (id: string) => void
}

export function FilesystemFavoritesSection({
  favorites,
  selectedPath,
  filesystem,
  customOpeners,
  onSelect,
  onRemoveFavorite,
}: FilesystemFavoritesSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="flex max-h-1/2 min-h-0 shrink-0 flex-col overflow-hidden border-b border-border">
      <div className="shrink-0 px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('filesystem.modern.favoritesTitle')}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {favorites.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t('filesystem.modern.favoritesEmpty')}
          </p>
        ) : (
          favorites.map((favorite) => {
            const entry = favoriteToEntry(favorite)
            const isSelected = selectedPath === favorite.path
            const rowContent = (
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  'flex min-w-0 cursor-default items-center gap-1.5 rounded-md py-1 pl-2 pr-2 text-sm outline-none',
                  isSelected ? 'bg-muted' : 'hover:bg-muted/80',
                )}
                onClick={() => onSelect(favorite.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(favorite.path)
                }}
              >
                <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" />
                <Folder className="size-4 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1 truncate" title={favorite.path}>
                  {favorite.displayName}
                </span>
              </div>
            )

            return (
              <FilesystemEntryContextMenu
                key={favorite.id}
                entry={entry}
                filesystem={filesystem}
                customOpeners={customOpeners}
                favoriteActions={{
                  isFavorite: true,
                  onAdd: () => {},
                  onRemove: () => onRemoveFavorite(favorite.id),
                }}
              >
                {rowContent}
              </FilesystemEntryContextMenu>
            )
          })
        )}
      </div>
    </div>
  )
}
