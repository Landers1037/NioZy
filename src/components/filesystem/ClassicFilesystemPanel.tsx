import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  ExternalLink,
  ImageIcon,
  Loader2,
  Terminal,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { getElectronAPI } from '@/lib/electron-client'
import { openTerminalInDirectory } from '@/lib/terminal-actions'
import { openPathWithCustom, openPathWithEditor } from '@/lib/filesystem-open'
import { parentDirectory } from '@/lib/path-utils'
import { useAppStore } from '@/stores/app-store'
import type {
  FilesystemCustomOpener,
  FilesystemSettings,
} from '../../../electron/shared/filesystem-settings'
import { isImageFilePath } from '../../../electron/shared/filesystem-image'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { FilesystemImagePreviewDialog } from '@/components/filesystem/FilesystemImagePreviewDialog'
import {
  entriesToNodes,
  entryKey,
  findNode,
  updateNode,
  type TreeNode,
} from '@/components/filesystem/filesystem-tree-utils'
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
  const { t } = useTranslation()
  const { entry, children, expanded, loading } = node
  const isDir = entry.isDirectory
  const isSelected = selectedPath === entry.path
  const isImage = !isDir && isImageFilePath(entry.path)

  const terminalCwd = isDir ? entry.path : parentDirectory(entry.path)
  const targetPath = entry.path

  const handleRowClick = () => {
    onSelect(entry)
    if (isImage && filesystem.imagePreviewEnabled) {
      onPreviewImage(entry)
    }
  }

  const handleDoubleClick = () => {
    if (isDir) {
      onToggle(entry.path)
      return
    }
    if (isImage && filesystem.imagePreviewEnabled) {
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
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleRowClick}
      onDoubleClick={handleDoubleClick}
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
      <ContextMenu>
        <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
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

export function ClassicFilesystemPanel() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const [roots, setRoots] = useState<TreeNode[]>([])
  const [loadingRoots, setLoadingRoots] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<{
    path: string
    name: string
  } | null>(null)

  const filesystem = settings?.filesystem

  const customOpeners = useMemo(
    () =>
      filesystem?.customOpeners.filter((o) => o.label.trim() && o.path.trim()) ?? [],
    [filesystem?.customOpeners],
  )

  const loadChildren = useCallback(
    async (dirPath: string) => {
      const result = await getElectronAPI().ssh.listLocal(dirPath)
      if (!result.ok || !result.entries) {
        toast.error(result.error ?? t('filesystem.listFailed'))
        return []
      }
      return entriesToNodes(result.entries)
    },
    [t],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingRoots(true)
      const result = await getElectronAPI().files.listRoots()
      if (cancelled) return
      setLoadingRoots(false)
      if (result.ok && result.entries) {
        setRoots(entriesToNodes(result.entries))
      } else {
        toast.error(result.error ?? t('filesystem.listFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleToggle = useCallback(
    (path: string) => {
      setRoots((prev) => {
        const node = findNode(prev, path)
        if (!node) return prev

        if (node.expanded) {
          return updateNode(prev, path, (n) => ({ ...n, expanded: false }))
        }

        if (node.loaded) {
          return updateNode(prev, path, (n) => ({ ...n, expanded: true }))
        }

        void (async () => {
          setRoots((p) =>
            updateNode(p, path, (n) => ({ ...n, loading: true, expanded: true })),
          )
          const children = await loadChildren(path)
          setRoots((p) =>
            updateNode(p, path, (n) => ({
              ...n,
              children,
              loading: false,
              loaded: true,
              expanded: true,
            })),
          )
        })()

        return updateNode(prev, path, (n) => ({
          ...n,
          loading: true,
          expanded: true,
        }))
      })
    },
    [loadChildren],
  )

  if (!filesystem) return null

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 no-drag select-none">
      <h2 className="mb-3 shrink-0 text-sm font-semibold text-foreground">
        {t('filesystem.title')}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-1">
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
              onToggle={handleToggle}
              onSelect={(entry) => setSelectedPath(entry.path)}
              onPreviewImage={(entry) =>
                setPreviewFile({ path: entry.path, name: entry.name })
              }
            />
          ))
        )}
      </div>

      <FilesystemImagePreviewDialog
        filePath={previewFile?.path ?? null}
        fileName={previewFile?.name ?? ''}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      />
    </div>
  )
}
