import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  ImageIcon,
  Loader2,
} from 'lucide-react'
import { FilesystemEntryContextMenu } from '@/components/filesystem/FilesystemEntryContextMenu'
import { FilesystemFavoritesSection } from '@/components/filesystem/FilesystemFavoritesSection'
import {
  entryKey,
  type TreeNode,
} from '@/components/filesystem/filesystem-tree-utils'
import type {
  FilesystemCustomOpener,
  FilesystemSettings,
} from '../../../electron/shared/filesystem-settings'
import type { FilesystemFavorite } from '../../../electron/shared/filesystem-favorites-types'
import { isImageFilePath } from '../../../electron/shared/filesystem-image'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { cn } from '@/lib/utils'

function TreeRow({
  node,
  depth,
  selectedPath,
  filesystem,
  customOpeners,
  onToggle,
  onSelect,
  onPreviewImage,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  onToggle: (path: string) => void
  onSelect: (entry: ScpFileEntry) => void
  onPreviewImage: (entry: ScpFileEntry) => void
}) {
  const { entry, children, expanded, loading } = node
  const isDir = entry.isDirectory
  const isSelected = selectedPath === entry.path
  const isImage = !isDir && isImageFilePath(entry.path)

  const handleRowClick = () => {
    onSelect(entry)
    if (isDir) {
      onToggle(entry.path)
    } else if (isImage && filesystem.imagePreviewEnabled) {
      onPreviewImage(entry)
    }
  }

  const rowContent = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex min-w-0 cursor-default items-center gap-1 rounded-md py-1 pr-2 text-sm outline-none',
        isSelected ? 'bg-muted' : 'hover:bg-muted/80',
      )}
      style={{ paddingLeft: `${depth * 14 + 6}px` }}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleRowClick()
      }}
    >
      {isDir ? (
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(entry.path)
          }}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      {isDir ? (
        <Folder className="size-4 shrink-0 text-amber-600" />
      ) : isImage ? (
        <ImageIcon className="size-4 shrink-0 text-sky-600" />
      ) : (
        <File className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate" title={entry.path}>
        {entry.name}
      </span>
    </div>
  )

  return (
    <>
      <FilesystemEntryContextMenu
        entry={entry}
        filesystem={filesystem}
        customOpeners={customOpeners}
      >
        {rowContent}
      </FilesystemEntryContextMenu>
      {isDir &&
        expanded &&
        children.map((child) => (
          <TreeRow
            key={entryKey(child.entry)}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            filesystem={filesystem}
            customOpeners={customOpeners}
            onToggle={onToggle}
            onSelect={onSelect}
            onPreviewImage={onPreviewImage}
          />
        ))}
    </>
  )
}

interface FilesystemTreeSidebarProps {
  roots: TreeNode[]
  loadingRoots: boolean
  favorites: FilesystemFavorite[]
  selectedPath: string | null
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  onToggle: (path: string) => void
  onSelect: (entry: ScpFileEntry) => void
  onFavoriteSelect: (path: string) => void
  onRemoveFavorite: (id: string) => void
  onPreviewImage: (entry: ScpFileEntry) => void
  panelClassName?: string
}

export function FilesystemTreeSidebar({
  roots,
  loadingRoots,
  favorites,
  selectedPath,
  filesystem,
  customOpeners,
  onToggle,
  onSelect,
  onFavoriteSelect,
  onRemoveFavorite,
  onPreviewImage,
  panelClassName,
}: FilesystemTreeSidebarProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-col border-r border-border bg-muted/20',
        panelClassName,
      )}
    >
      <FilesystemFavoritesSection
        favorites={favorites}
        selectedPath={selectedPath}
        filesystem={filesystem}
        customOpeners={customOpeners}
        onSelect={onFavoriteSelect}
        onRemoveFavorite={onRemoveFavorite}
      />
      <div className="shrink-0 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('filesystem.modern.treeTitle')}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {loadingRoots ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('common.noItems')}
          </p>
        ) : (
          roots.map((node) => (
            <TreeRow
              key={entryKey(node.entry)}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              filesystem={filesystem}
              customOpeners={customOpeners}
              onToggle={onToggle}
              onSelect={onSelect}
              onPreviewImage={onPreviewImage}
            />
          ))
        )}
      </div>
    </div>
  )
}
