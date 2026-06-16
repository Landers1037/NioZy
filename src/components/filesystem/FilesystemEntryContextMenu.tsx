import { useTranslation } from 'react-i18next'
import { ExternalLink, FileCode, Terminal } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { openTerminalInDirectory } from '@/lib/terminal-actions'
import { openPathWithCustom, openPathWithEditor } from '@/lib/filesystem-open'
import { parentDirectory } from '@/lib/path-utils'
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
}

export function FilesystemEntryContextMenu({
  entry,
  filesystem,
  customOpeners,
  children,
}: FilesystemEntryContextMenuProps) {
  const { t } = useTranslation()
  const terminalCwd = entry.isDirectory ? entry.path : parentDirectory(entry.path)
  const targetPath = entry.path

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
