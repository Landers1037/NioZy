import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getElectronAPI } from '@/lib/electron-client'
import { openMarkdownFile } from '@/lib/markdown-tab-actions'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { WorkspaceDirEntry } from '../../../electron/shared/workspace-types'
import { isMarkdownFilePath } from '../../../electron/shared/markdown-file-limits'
import { cn } from '@/lib/utils'

interface TreeNodeState {
  entry: WorkspaceDirEntry
  children: TreeNodeState[]
  expanded: boolean
  loading: boolean
  loaded: boolean
}

interface WorkspaceFileTreeProps {
  tabId: string
  rootPath: string
}

function entryKey(entry: WorkspaceDirEntry): string {
  return entry.path
}

function updateNode(
  nodes: TreeNodeState[],
  path: string,
  updater: (node: TreeNodeState) => TreeNodeState,
): TreeNodeState[] {
  return nodes.map((node) => {
    if (node.entry.path === path) return updater(node)
    if (node.children.length > 0) {
      return { ...node, children: updateNode(node.children, path, updater) }
    }
    return node
  })
}

function TreeRow({
  node,
  depth,
  onToggle,
  onOpenFile,
}: {
  node: TreeNodeState
  depth: number
  onToggle: (path: string) => void
  onOpenFile: (entry: WorkspaceDirEntry) => void
}) {
  const { entry, children, expanded, loading } = node
  const isDir = entry.isDirectory

  return (
    <>
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 text-sm hover:bg-muted/80',
          isDir || isMarkdownFilePath(entry.path) ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => {
          if (isDir) onToggle(entry.path)
          else onOpenFile(entry)
        }}
      >
        {isDir ? (
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
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
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate" title={entry.path}>
          {entry.name}
        </span>
      </div>
      {isDir && expanded
        ? children.map((child) => (
            <TreeRow
              key={entryKey(child.entry)}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
            />
          ))
        : null}
    </>
  )
}

export function WorkspaceFileTree({ tabId, rootPath }: WorkspaceFileTreeProps) {
  const { t } = useTranslation()
  const cacheDirEntries = useWorkspaceStore((s) => s.cacheDirEntries)
  const getCachedDirEntries = useWorkspaceStore((s) => s.getCachedDirEntries)
  const clearFileTreeCache = useWorkspaceStore((s) => s.clearFileTreeCache)
  const [roots, setRoots] = useState<TreeNodeState[]>([])
  const [loading, setLoading] = useState(true)

  const entriesToNodes = useCallback((entries: WorkspaceDirEntry[]): TreeNodeState[] => {
    return entries.map((entry) => ({
      entry,
      children: [],
      expanded: false,
      loading: false,
      loaded: false,
    }))
  }, [])

  const loadDirectory = useCallback(
    async (dirPath: string, useCache = true): Promise<WorkspaceDirEntry[]> => {
      if (useCache) {
        const cached = getCachedDirEntries(tabId, dirPath)
        if (cached) return cached
      }
      const result = await getElectronAPI().workspace.listDir(dirPath)
      if (!result.ok) return []
      cacheDirEntries(tabId, dirPath, result.entries)
      return result.entries
    },
    [cacheDirEntries, getCachedDirEntries, tabId],
  )

  const refreshRoot = useCallback(async () => {
    setLoading(true)
    const entries = await loadDirectory(rootPath, false)
    setRoots(entriesToNodes(entries))
    setLoading(false)
  }, [entriesToNodes, loadDirectory, rootPath])

  useEffect(() => {
    void refreshRoot()
  }, [refreshRoot])

  const handleToggle = useCallback(
    async (path: string) => {
      const node = findNode(roots, path)
      if (!node || !node.entry.isDirectory) return

      if (node.expanded) {
        setRoots((prev) =>
          updateNode(prev, path, (n) => ({ ...n, expanded: false })),
        )
        return
      }

      if (node.loaded && node.children.length > 0) {
        setRoots((prev) =>
          updateNode(prev, path, (n) => ({ ...n, expanded: true })),
        )
        return
      }

      setRoots((prev) =>
        updateNode(prev, path, (n) => ({ ...n, loading: true, expanded: true })),
      )

      const entries = await loadDirectory(path)
      setRoots((prev) =>
        updateNode(prev, path, (n) => ({
          ...n,
          loading: false,
          loaded: true,
          children: entriesToNodes(entries),
        })),
      )
    },
    [entriesToNodes, loadDirectory, roots],
  )

  const handleRefresh = () => {
    clearFileTreeCache(tabId)
    void refreshRoot()
  }

  const handleOpenFile = useCallback((entry: WorkspaceDirEntry) => {
    if (!entry.isDirectory && isMarkdownFilePath(entry.path)) {
      void openMarkdownFile(entry.path)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="truncate text-xs text-muted-foreground" title={rootPath}>
          {rootPath}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={handleRefresh}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('workspace.emptyDir')}</p>
        ) : (
          roots.map((node) => (
            <TreeRow
              key={entryKey(node.entry)}
              node={node}
              depth={0}
              onToggle={handleToggle}
              onOpenFile={handleOpenFile}
            />
          ))
        )}
      </div>
    </div>
  )
}

function findNode(nodes: TreeNodeState[], path: string): TreeNodeState | undefined {
  for (const node of nodes) {
    if (node.entry.path === path) return node
    const found = findNode(node.children, path)
    if (found) return found
  }
  return undefined
}
