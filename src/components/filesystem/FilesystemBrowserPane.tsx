import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  ChevronUp,
  File,
  Folder,
  HardDrive,
  ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilesystemEntryContextMenu } from '@/components/filesystem/FilesystemEntryContextMenu'
import { formatFileSize, getPathChain } from '@/components/filesystem/filesystem-tree-utils'
import type {
  FilesystemCustomOpener,
  FilesystemSettings,
} from '../../../electron/shared/filesystem-settings'
import { isImageFilePath } from '../../../electron/shared/filesystem-image'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import {
  canGoUpScpLocalPath,
  isScpLocalRoots,
  parentScpLocalPath,
  SCP_LOCAL_ROOTS,
} from '@/lib/scp-local-path'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'

export type FilesystemViewMode = 'list' | 'grid'

interface FilesystemBrowserPaneProps {
  currentPath: string
  entries: ScpFileEntry[]
  loading: boolean
  selectedPath: string | null
  viewMode: FilesystemViewMode
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  isFavoritePath: (path: string) => boolean
  onAddFavorite: (path: string) => void
  onRemoveFavorite: (path: string) => void
  onViewModeChange: (mode: FilesystemViewMode) => void
  onNavigate: (path: string) => void
  onSelect: (entry: ScpFileEntry) => void
  onEnter: (entry: ScpFileEntry) => void
  onRefresh: () => void
  onPreviewImage: (entry: ScpFileEntry) => void
  panelClassName?: string
}

function isDriveRoot(entry: ScpFileEntry): boolean {
  return /^[A-Za-z]:\\?$/.test(entry.path.replace(/\//g, '\\'))
}

function EntryIcon({
  entry,
  isRootsView,
  large = false,
}: {
  entry: ScpFileEntry
  isRootsView: boolean
  large?: boolean
}) {
  const sizeClass = large ? 'size-10' : 'size-4'
  if (isRootsView && isDriveRoot(entry)) {
    return <HardDrive className={cn(sizeClass, 'shrink-0 text-primary')} />
  }
  if (entry.isDirectory) {
    return <Folder className={cn(sizeClass, 'shrink-0 text-amber-600')} />
  }
  if (isImageFilePath(entry.path)) {
    return <ImageIcon className={cn(sizeClass, 'shrink-0 text-sky-600')} />
  }
  return <File className={cn(sizeClass, 'shrink-0 text-muted-foreground')} />
}

function Breadcrumb({
  currentPath,
  onNavigate,
}: {
  currentPath: string
  onNavigate: (path: string) => void
}) {
  const { t } = useTranslation()

  if (isScpLocalRoots(currentPath)) {
    return (
      <button
        type="button"
        className="truncate text-sm font-medium text-foreground hover:underline"
        onClick={() => onNavigate(SCP_LOCAL_ROOTS)}
      >
        {t('filesystem.modern.thisPc')}
      </button>
    )
  }

  const segments: { label: string; path: string }[] = [
    { label: t('filesystem.modern.thisPc'), path: SCP_LOCAL_ROOTS },
  ]

  const chain = getPathChain(currentPath)
  for (let i = 0; i < chain.length; i++) {
    const path = chain[i]!
    const label =
      i === 0 ? path : path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1)
    segments.push({ label, path })
  }

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-label="Breadcrumb">
      {segments.map((seg, index) => (
        <span key={seg.path} className="flex min-w-0 items-center gap-0.5">
          {index > 0 && (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <button
            type="button"
            className={cn(
              'truncate text-sm hover:underline',
              index === segments.length - 1
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
            title={seg.path === SCP_LOCAL_ROOTS ? undefined : seg.path}
            onClick={() => onNavigate(seg.path)}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  )
}

function buildFavoriteActions(
  entry: ScpFileEntry,
  isFavoritePath: (path: string) => boolean,
  onAddFavorite: (path: string) => void,
  onRemoveFavorite: (path: string) => void,
) {
  if (!entry.isDirectory) return undefined
  const isFavorite = isFavoritePath(entry.path)
  return {
    isFavorite,
    onAdd: () => onAddFavorite(entry.path),
    onRemove: () => onRemoveFavorite(entry.path),
  }
}

function ListView({
  entries,
  selectedPath,
  isRootsView,
  filesystem,
  customOpeners,
  isFavoritePath,
  onAddFavorite,
  onRemoveFavorite,
  onSelect,
  onEnter,
  onPreviewImage,
}: {
  entries: ScpFileEntry[]
  selectedPath: string | null
  isRootsView: boolean
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  isFavoritePath: (path: string) => boolean
  onAddFavorite: (path: string) => void
  onRemoveFavorite: (path: string) => void
  onSelect: (entry: ScpFileEntry) => void
  onEnter: (entry: ScpFileEntry) => void
  onPreviewImage: (entry: ScpFileEntry) => void
}) {
  const { t } = useTranslation()

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-[1] border-b border-border bg-muted/40 backdrop-blur-sm">
        <tr className="text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">{t('filesystem.modern.columnName')}</th>
          <th className="hidden w-28 px-3 py-2 font-medium sm:table-cell">
            {t('filesystem.modern.columnSize')}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const isImage = !entry.isDirectory && isImageFilePath(entry.path)
          const handleClick = () => {
            onSelect(entry)
            if (!entry.isDirectory && isImage && filesystem.imagePreviewEnabled) {
              onPreviewImage(entry)
            }
          }
          const handleDoubleClick = () => {
            if (entry.isDirectory || (isRootsView && isDriveRoot(entry))) {
              onEnter(entry)
            } else if (isImage && filesystem.imagePreviewEnabled) {
              onPreviewImage(entry)
            }
          }

          return (
            <FilesystemEntryContextMenu
              key={entry.path}
              entry={entry}
              filesystem={filesystem}
              customOpeners={customOpeners}
              favoriteActions={buildFavoriteActions(
                entry,
                isFavoritePath,
                onAddFavorite,
                onRemoveFavorite,
              )}
            >
              <tr
                role="button"
                tabIndex={0}
                className={cn(
                  'cursor-default border-b border-border/50 outline-none last:border-0 hover:bg-muted/60',
                  selectedPath === entry.path && 'bg-muted',
                )}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDoubleClick()
                }}
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <EntryIcon entry={entry} isRootsView={isRootsView} />
                    <span className="min-w-0 truncate" title={entry.path}>
                      {entry.name}
                    </span>
                  </div>
                </td>
                <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground sm:table-cell">
                  {entry.isDirectory ? '—' : formatFileSize(entry.size)}
                </td>
              </tr>
            </FilesystemEntryContextMenu>
          )
        })}
      </tbody>
    </table>
  )
}

function GridView({
  entries,
  selectedPath,
  isRootsView,
  filesystem,
  customOpeners,
  isFavoritePath,
  onAddFavorite,
  onRemoveFavorite,
  onSelect,
  onEnter,
  onPreviewImage,
}: {
  entries: ScpFileEntry[]
  selectedPath: string | null
  isRootsView: boolean
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  isFavoritePath: (path: string) => boolean
  onAddFavorite: (path: string) => void
  onRemoveFavorite: (path: string) => void
  onSelect: (entry: ScpFileEntry) => void
  onEnter: (entry: ScpFileEntry) => void
  onPreviewImage: (entry: ScpFileEntry) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2 p-3">
      {entries.map((entry) => {
        const isImage = !entry.isDirectory && isImageFilePath(entry.path)
        const handleClick = () => {
          onSelect(entry)
          if (!entry.isDirectory && isImage && filesystem.imagePreviewEnabled) {
            onPreviewImage(entry)
          }
        }
        const handleDoubleClick = () => {
          if (entry.isDirectory || (isRootsView && isDriveRoot(entry))) {
            onEnter(entry)
          } else if (isImage && filesystem.imagePreviewEnabled) {
            onPreviewImage(entry)
          }
        }

        return (
          <FilesystemEntryContextMenu
            key={entry.path}
            entry={entry}
            filesystem={filesystem}
            customOpeners={customOpeners}
            favoriteActions={buildFavoriteActions(
              entry,
              isFavoritePath,
              onAddFavorite,
              onRemoveFavorite,
            )}
          >
            <button
              type="button"
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 text-center transition-colors hover:bg-muted/60',
                selectedPath === entry.path && 'border-border bg-muted',
              )}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
            >
              <EntryIcon entry={entry} isRootsView={isRootsView} large />
              <span className="line-clamp-2 w-full text-xs leading-tight" title={entry.name}>
                {entry.name}
              </span>
            </button>
          </FilesystemEntryContextMenu>
        )
      })}
    </div>
  )
}

export function FilesystemBrowserPane({
  currentPath,
  entries,
  loading,
  selectedPath,
  viewMode,
  filesystem,
  customOpeners,
  isFavoritePath,
  onAddFavorite,
  onRemoveFavorite,
  onViewModeChange,
  onNavigate,
  onSelect,
  onEnter,
  onRefresh,
  onPreviewImage,
  panelClassName,
}: FilesystemBrowserPaneProps) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const isRootsView = isScpLocalRoots(currentPath)
  const canGoUp = canGoUpScpLocalPath(currentPath)

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', panelClassName)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Breadcrumb currentPath={currentPath} onNavigate={onNavigate} />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!canGoUp}
            title={t('filesystem.modern.goUp')}
            onClick={() => onNavigate(parentScpLocalPath(currentPath))}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title={t('filesystem.modern.refresh')}
            onClick={onRefresh}
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
          <div
            className={cn(
              'ml-1 inline-flex rounded-lg border border-border p-0.5',
              ui.segmentGroupBg,
            )}
            role="tablist"
            aria-label={t('filesystem.modern.viewModeAria')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              title={t('filesystem.modern.listView')}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                viewMode === 'list'
                  ? cn(ui.segmentActive, 'font-app-bold')
                  : ui.segmentInactive,
              )}
              onClick={() => onViewModeChange('list')}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              title={t('filesystem.modern.gridView')}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                viewMode === 'grid'
                  ? cn(ui.segmentActive, 'font-app-bold')
                  : ui.segmentInactive,
              )}
              onClick={() => onViewModeChange('grid')}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t('common.noItems')}
          </p>
        ) : viewMode === 'grid' ? (
          <GridView
            entries={entries}
            selectedPath={selectedPath}
            isRootsView={isRootsView}
            filesystem={filesystem}
            customOpeners={customOpeners}
            isFavoritePath={isFavoritePath}
            onAddFavorite={onAddFavorite}
            onRemoveFavorite={onRemoveFavorite}
            onSelect={onSelect}
            onEnter={onEnter}
            onPreviewImage={onPreviewImage}
          />
        ) : (
          <ListView
            entries={entries}
            selectedPath={selectedPath}
            isRootsView={isRootsView}
            filesystem={filesystem}
            customOpeners={customOpeners}
            isFavoritePath={isFavoritePath}
            onAddFavorite={onAddFavorite}
            onRemoveFavorite={onRemoveFavorite}
            onSelect={onSelect}
            onEnter={onEnter}
            onPreviewImage={onPreviewImage}
          />
        )}
      </div>
    </div>
  )
}
