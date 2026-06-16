import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FilesystemTreeSidebar } from '@/components/filesystem/FilesystemTreeSidebar'
import {
  FilesystemBrowserPane,
  type FilesystemViewMode,
} from '@/components/filesystem/FilesystemBrowserPane'
import { FilesystemImagePreviewDialog } from '@/components/filesystem/FilesystemImagePreviewDialog'
import {
  entriesToNodes,
  filterFilesystemEntries,
  findNode,
  getPathChain,
  updateNode,
  type TreeNode,
} from '@/components/filesystem/filesystem-tree-utils'
import { getElectronAPI } from '@/lib/electron-client'
import { isScpLocalRoots, SCP_LOCAL_ROOTS } from '@/lib/scp-local-path'
import { usePaneResize } from '@/hooks/usePaneResize'
import { useAppStore } from '@/stores/app-store'
import { useUiClasses } from '@/lib/ui-style'
import type { ScpFileEntry } from '../../../electron/shared/ssh-types'
import { cn } from '@/lib/utils'

const DEFAULT_TREE_WIDTH = 240
const MIN_TREE_WIDTH = 160
const MAX_TREE_WIDTH = 480

export function ModernFilesystemPanel() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const ui = useUiClasses()
  const filesystem = settings?.filesystem

  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH)
  const { containerRef, isResizing, startResize } = usePaneResize({
    width: treeWidth,
    minWidth: MIN_TREE_WIDTH,
    maxWidth: MAX_TREE_WIDTH,
    onCommit: setTreeWidth,
  })

  const [roots, setRoots] = useState<TreeNode[]>([])
  const rootsRef = useRef(roots)
  useEffect(() => {
    rootsRef.current = roots
  }, [roots])
  const [loadingRoots, setLoadingRoots] = useState(true)
  const [browserPath, setBrowserPath] = useState(SCP_LOCAL_ROOTS)
  const [browserEntries, setBrowserEntries] = useState<ScpFileEntry[]>([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<FilesystemViewMode>('grid')
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string } | null>(null)

  const customOpeners = useMemo(
    () =>
      filesystem?.customOpeners.filter((o) => o.label.trim() && o.path.trim()) ?? [],
    [filesystem?.customOpeners],
  )

  const loadDirectoryChildren = useCallback(
    async (dirPath: string) => {
      const result = await getElectronAPI().ssh.listLocal(dirPath)
      if (!result.ok || !result.entries) {
        toast.error(result.error ?? t('filesystem.listFailed'))
        return []
      }
      return entriesToNodes(
        result.entries.filter((entry) => entry.isDirectory),
      )
    },
    [t],
  )

  const loadBrowserDirectory = useCallback(
    async (path: string) => {
      setBrowserLoading(true)
      try {
        if (isScpLocalRoots(path)) {
          const result = await getElectronAPI().files.listRoots()
          if (result.ok && result.entries) {
            setBrowserEntries(filterFilesystemEntries(result.entries))
          } else {
            toast.error(result.error ?? t('filesystem.listFailed'))
            setBrowserEntries([])
          }
          return
        }

        const result = await getElectronAPI().ssh.listLocal(path)
        if (result.ok && result.entries) {
          setBrowserEntries(filterFilesystemEntries(result.entries))
        } else {
          toast.error(result.error ?? t('filesystem.listFailed'))
          setBrowserEntries([])
        }
      } finally {
        setBrowserLoading(false)
      }
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

  useEffect(() => {
    void loadBrowserDirectory(browserPath)
  }, [browserPath, loadBrowserDirectory])

  const ensureTreePathVisible = useCallback(
    async (targetPath: string) => {
      if (isScpLocalRoots(targetPath)) return

      const chain = getPathChain(targetPath)
      for (const dirPath of chain) {
        const node = findNode(rootsRef.current, dirPath)
        if (!node?.entry.isDirectory) continue

        if (node.loaded) {
          setRoots((prev) =>
            updateNode(prev, dirPath, (n) => ({ ...n, expanded: true })),
          )
          continue
        }

        setRoots((prev) =>
          updateNode(prev, dirPath, (n) => ({ ...n, loading: true, expanded: true })),
        )
        const children = await loadDirectoryChildren(dirPath)
        await new Promise<void>((resolve) => {
          setRoots((prev) => {
            resolve()
            return updateNode(prev, dirPath, (n) => ({
              ...n,
              children,
              loading: false,
              loaded: true,
              expanded: true,
            }))
          })
        })
      }
    },
    [loadDirectoryChildren],
  )

  const handleTreeToggle = useCallback(
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
          const children = await loadDirectoryChildren(path)
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
    [loadDirectoryChildren],
  )

  const navigateTo = useCallback(
    (path: string) => {
      setBrowserPath(path)
      setSelectedPath(path)
      if (!isScpLocalRoots(path)) {
        void ensureTreePathVisible(path)
      }
    },
    [ensureTreePathVisible],
  )

  const handleTreeSelect = useCallback(
    (entry: ScpFileEntry) => {
      setSelectedPath(entry.path)
      if (entry.isDirectory) {
        navigateTo(entry.path)
      }
    },
    [navigateTo],
  )

  const handleBrowserEnter = useCallback(
    (entry: ScpFileEntry) => {
      if (!entry.isDirectory) return
      let nextPath = entry.path
      if (/^[A-Za-z]:$/.test(nextPath.replace(/\//g, '\\'))) {
        nextPath = `${nextPath[0]!.toUpperCase()}:\\`
      }
      navigateTo(nextPath)
    },
    [navigateTo],
  )

  if (!filesystem) return null

  return (
    <div className="flex h-full flex-col overflow-hidden no-drag select-none">
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t('filesystem.title')}</h2>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={containerRef}
          className="relative shrink-0"
          style={{ width: treeWidth }}
        >
          <FilesystemTreeSidebar
            roots={roots}
            loadingRoots={loadingRoots}
            selectedPath={selectedPath}
            filesystem={filesystem}
            customOpeners={customOpeners}
            onToggle={handleTreeToggle}
            onSelect={handleTreeSelect}
            onPreviewImage={(entry) =>
              setPreviewFile({ path: entry.path, name: entry.name })
            }
            panelClassName="h-full"
          />
          <div
            role="separator"
            aria-orientation="vertical"
            className={cn(
              'absolute inset-y-0 -right-px z-10 w-1.5 cursor-col-resize',
              ui.sidebarResizeHover,
              isResizing && ui.sidebarResizeActive,
            )}
            onPointerDown={startResize}
          />
        </div>

        <FilesystemBrowserPane
          currentPath={browserPath}
          entries={browserEntries}
          loading={browserLoading}
          selectedPath={selectedPath}
          viewMode={viewMode}
          filesystem={filesystem}
          customOpeners={customOpeners}
          onViewModeChange={setViewMode}
          onNavigate={navigateTo}
          onSelect={(entry) => setSelectedPath(entry.path)}
          onEnter={handleBrowserEnter}
          onRefresh={() => void loadBrowserDirectory(browserPath)}
          onPreviewImage={(entry) =>
            setPreviewFile({ path: entry.path, name: entry.name })
          }
          panelClassName="bg-card/50"
        />
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
