import { useTranslation } from 'react-i18next'
import { ExternalLink, FileCode, FileText, Star, Terminal } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { openTerminalInDirectory } from '@/lib/terminal-actions'
import { openPathWithCustom, openPathWithEditor } from '@/lib/filesystem-open'
import { openMarkdownFile } from '@/lib/markdown-tab-actions'
import { parentDirectory } from '@/lib/path-utils'
import { isMarkdownFilePath } from '../../../electron/shared/markdown-file-limits'
import type {
  FilesystemCustomOpener,
  FilesystemSettings,
} from '../../../electron/shared/filesystem-settings'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'

interface FilesystemEntryContextMenuProps {
  entry: ScpFileEntry
  filesystem: FilesystemSettings
  customOpeners: FilesystemCustomOpener[]
  children: React.ReactNode
  /** 目录收藏相关操作（仅目录且传入时显示） */
  favoriteActions?: {
    isFavorite: boolean
    onAdd: () => void
    onRemove: () => void
  }
}

export function FilesystemEntryContextMenu({
  entry,
  filesystem,
  customOpeners,
  children,
  favoriteActions,
}: FilesystemEntryContextMenuProps) {
  const { t } = useTranslation()
  const terminalCwd = entry.isDirectory ? entry.path : parentDirectory(entry.path)
  const targetPath = entry.path
  const isMarkdownFile = !entry.isDirectory && isMarkdownFilePath(entry.path)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            void openTerminalInDirectory(terminalCwd)
          }}
        >
          <Terminal className="size-4 text-muted-foreground" />
          {t('filesystem.newTerminalHere')}
        </ContextMenuItem>
        {entry.isDirectory && favoriteActions && (
          <>
            <ContextMenuSeparator />
            {favoriteActions.isFavorite ? (
              <ContextMenuItem onSelect={favoriteActions.onRemove}>
                <Star className="size-4 fill-amber-500 text-amber-500" />
                {t('filesystem.removeFromFavorites')}
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={favoriteActions.onAdd}>
                <Star className="size-4 text-muted-foreground" />
                {t('filesystem.addToFavorites')}
              </ContextMenuItem>
            )}
          </>
        )}
        {isMarkdownFile && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                void openMarkdownFile(targetPath)
              }}
            >
              <FileText className="size-4 text-muted-foreground" />
              {t('common.open')}
            </ContextMenuItem>
          </>
        )}
        {(filesystem.openWithVsCode ||
          filesystem.openWithCursor ||
          customOpeners.length > 0) && <ContextMenuSeparator />}
        {filesystem.openWithVsCode && (
          <ContextMenuItem
            onSelect={() => {
              void openPathWithEditor(filesystem, 'vscode', targetPath)
            }}
          >
            <FileCode className="size-4 text-muted-foreground" />
            {t('filesystem.openWithVsCode')}
          </ContextMenuItem>
        )}
        {filesystem.openWithCursor && (
          <ContextMenuItem
            onSelect={() => {
              void openPathWithEditor(filesystem, 'cursor', targetPath)
            }}
          >
            <FileCode className="size-4 text-muted-foreground" />
            {t('filesystem.openWithCursor')}
          </ContextMenuItem>
        )}
        {customOpeners.map((opener) => (
          <ContextMenuItem
            key={opener.id}
            onSelect={() => {
              void openPathWithCustom(opener.path, targetPath)
            }}
          >
            <ExternalLink className="size-4 text-muted-foreground" />
            {t('filesystem.openWithCustom', { name: opener.label })}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
