import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  Loader2,
  Terminal,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { getElectronAPI } from '@/lib/electron-client'
import { openTerminalInDirectory } from '@/lib/terminal-actions'
import { parentDirectory } from '@/lib/path-utils'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { cn } from '@/lib/utils'

interface TreeNode {
  entry: ScpFileEntry
  children: TreeNode[]
  expanded: boolean
  loading: boolean
  loaded: boolean
}

function entryKey(entry: ScpFileEntry): string {
  return entry.path
}

function TreeRow({
  node,
  depth,
  onToggle,
}: {
  node: TreeNode
  depth: number
  onToggle: (path: string) => void
}) {
  const { t } = useTranslation()
  const { entry, children, expanded, loading } = node
  const isDir = entry.isDirectory

  const terminalCwd = isDir ? entry.path : parentDirectory(entry.path)

  const rowContent = (
    <div
      className={cn(
        'flex min-w-0 cursor-default items-center gap-1 rounded-md py-1 pr-2 text-sm hover:bg-muted/80',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
        </ContextMenuContent>
      </ContextMenu>
      {isDir && expanded &&
        children.map((child) => (
          <TreeRow
            key={entryKey(child.entry)}
            node={child}
            depth={depth + 1}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

function updateNode(
  nodes: TreeNode[],
  path: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((n) => {
    if (n.entry.path === path) return updater(n)
    if (n.children.length > 0) {
      return { ...n, children: updateNode(n.children, path, updater) }
    }
    return n
  })
}

function entriesToNodes(entries: ScpFileEntry[]): TreeNode[] {
  return entries.map((entry) => ({
    entry,
    children: [],
    expanded: false,
    loading: false,
    loaded: false,
  }))
}

export function FilesystemPanel() {
  const { t } = useTranslation()
  const [roots, setRoots] = useState<TreeNode[]>([])
  const [loadingRoots, setLoadingRoots] = useState(true)

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

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 no-drag">
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
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  )
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.entry.path === path) return n
    const found = findNode(n.children, path)
    if (found) return found
  }
  return undefined
}
