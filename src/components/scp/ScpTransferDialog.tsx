import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { devError, devLog } from '../../../electron/shared/dev-log'
import { getSshConnection } from '@/lib/ssh-connection'
import { getTabDisplayTitle } from '@/lib/tab-display'
import type { ScpFileEntry, ScpTransferProgress } from '../../../electron/shared/api-types'
import type { ScpListRemoteOptions } from '../../../electron/shared/ssh-types'
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  Folder,
  File,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  canGoUpScpLocalPath,
  initialScpLocalPath,
  isScpLocalRoots,
  parentScpLocalPath,
  SCP_LOCAL_ROOTS,
} from '@/lib/scp-local-path'
import { basenameFromPath } from '@/lib/path-utils'
import {
  buildRemoteUploadTarget,
  isLocalDirectory,
} from '@/lib/scp-transfer-actions'
import {
  getDroppedFilePaths,
  hasExternalFileDrag,
} from '@/lib/terminal-drop-actions'

function formatTransferBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

interface ScpTransferDialogProps {
  tab: AppTab
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FileListPanel({
  title,
  path,
  entries,
  loading,
  selectedPath,
  onSelect,
  onEnterDir,
  onGoUp,
  onRefresh,
  canGoUp = true,
  acceptFileDrop = false,
  fileDropActive = false,
  onFileDropActiveChange,
  onFilesDrop,
}: {
  title: string
  path: string
  entries: ScpFileEntry[]
  loading: boolean
  selectedPath: string | null
  onSelect: (entry: ScpFileEntry) => void
  onEnterDir: (entry: ScpFileEntry) => void
  onGoUp: () => void
  onRefresh: () => void
  canGoUp?: boolean
  acceptFileDrop?: boolean
  fileDropActive?: boolean
  onFileDropActiveChange?: (active: boolean) => void
  onFilesDrop?: (paths: string[]) => void
}) {
  const { t } = useTranslation()

  const handleDragEnter = (e: React.DragEvent) => {
    if (!acceptFileDrop || !hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    onFileDropActiveChange?.(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptFileDrop || !hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    onFileDropActiveChange?.(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!acceptFileDrop || !hasExternalFileDrag(e.dataTransfer)) return
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    onFileDropActiveChange?.(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!acceptFileDrop || !hasExternalFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    onFileDropActiveChange?.(false)
    const paths = getDroppedFilePaths(e.dataTransfer)
    if (paths.length > 0) onFilesDrop?.(paths)
  }

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-muted/30',
        acceptFileDrop && fileDropActive && 'ring-2 ring-primary/50',
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{title}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={path}>
          {path}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canGoUp}
          onClick={onGoUp}
        >
          <ChevronUp className="size-4" />
          <span className="sr-only">{t('scp.goUp')}</span>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onRefresh}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          <span className="sr-only">{t('scp.refresh')}</span>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                    selectedPath === entry.path && 'bg-muted',
                  )}
                  onClick={() => onSelect(entry)}
                  onDoubleClick={() => entry.isDirectory && onEnterDir(entry)}
                >
                  {entry.isDirectory ? (
                    <Folder className="size-4 shrink-0 text-amber-600" />
                  ) : (
                    <File className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {!entry.isDirectory && entry.size != null && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {entry.size < 1024
                        ? `${entry.size} B`
                        : entry.size < 1024 * 1024
                          ? `${(entry.size / 1024).toFixed(1)} KB`
                          : `${(entry.size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {acceptFileDrop && fileDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/10">
          <p className="px-4 text-center text-sm font-medium text-primary">{t('scp.dropToUploadHint')}</p>
        </div>
      ) : null}
    </div>
  )
}

export function ScpTransferDialog({ tab, open, onOpenChange }: ScpTransferDialogProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const terminalCwds = useAppStore((s) => s.terminalCwds)

  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('~')
  const [localEntries, setLocalEntries] = useState<ScpFileEntry[]>([])
  const [remoteEntries, setRemoteEntries] = useState<ScpFileEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedLocal, setSelectedLocal] = useState<ScpFileEntry | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<ScpFileEntry | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [transferProgress, setTransferProgress] = useState<ScpTransferProgress | null>(null)
  const [remoteDropActive, setRemoteDropActive] = useState(false)
  const remoteListQueue = useRef(Promise.resolve())

  const connection = getSshConnection(settings, tab.sshConnectionId)
  const connectionId = tab.sshConnectionId
  const displayTitle = getTabDisplayTitle(tab)

  const loadLocal = useCallback(async (dir: string) => {
    setLocalLoading(true)
    try {
      if (isScpLocalRoots(dir)) {
        setLocalPath(SCP_LOCAL_ROOTS)
        const result = await getElectronAPI().files.listRoots()
        if (result.ok && result.entries) {
          setLocalEntries(result.entries)
        } else {
          toast.error(result.error ?? t('scp.listFailed'))
        }
        return
      }

      setLocalPath(dir)
      const result = await getElectronAPI().ssh.listLocal(dir)
      if (result.ok && result.entries) {
        setLocalEntries(result.entries)
      } else {
        toast.error(result.error ?? t('scp.listFailed'))
      }
    } finally {
      setLocalLoading(false)
    }
  }, [t])

  const loadRemote = useCallback(
    (dir: string, options?: ScpListRemoteOptions) => {
      if (!connectionId) return Promise.resolve()

      const run = async () => {
        setRemoteLoading(true)
        devLog('[NioZy][SCP] renderer listRemote start', {
          connectionId,
          dir,
          afterTransfer: Boolean(options?.afterTransfer),
        })
        try {
          const result = await getElectronAPI().ssh.listRemote(connectionId, dir, options)
          devLog('[NioZy][SCP] renderer listRemote done', {
            ok: result.ok,
            entryCount: result.entries?.length,
            resolvedPath: result.resolvedPath,
            error: result.error,
          })
          if (result.ok && result.entries) {
            setRemoteEntries(result.entries)
            setRemotePath(result.resolvedPath ?? dir)
          } else if (!options?.afterTransfer) {
            toast.error(result.error ?? t('scp.listFailed'))
          } else {
            toast.message(t('scp.refreshAfterTransferFailed'))
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          devError('[NioZy][SCP] renderer listRemote error', message)
          if (!options?.afterTransfer) {
            toast.error(message || t('scp.listFailed'))
          }
        } finally {
          setRemoteLoading(false)
        }
      }

      const next = remoteListQueue.current.then(run, run)
      remoteListQueue.current = next
      return next
    },
    [connectionId, t],
  )

  useEffect(() => {
    if (!open || !tab.sshConnectionId) return
    let cancelled = false

    void (async () => {
      devLog('[NioZy][SCP] renderer open panel', {
        connectionId: tab.sshConnectionId,
        tabId: tab.id,
      })
      const prof = await getElectronAPI().ssh.getProfile(tab.sshConnectionId!)
      if (cancelled) return
      if (!prof) {
        devError('[NioZy][SCP] renderer getProfile failed')
        toast.error(t('scp.profileFailed'))
        onOpenChange(false)
        return
      }
      devLog('[NioZy][SCP] renderer getProfile ok', {
        host: prof.host,
        user: prof.user,
        hasPassword: Boolean(prof.password),
        hasKey: Boolean(prof.keyPath),
      })
      const initialLocal = initialScpLocalPath(
        tab.terminalId,
        terminalCwds,
        Boolean(tab.sshConnectionId),
      )
      setLocalPath(initialLocal)
      setRemotePath('~')
      setSelectedLocal(null)
      setSelectedRemote(null)
      await loadLocal(initialLocal)
      if (!cancelled) await loadRemote('~')
    })()

    return () => {
      cancelled = true
    }
  }, [open, tab.sshConnectionId, tab.terminalId, terminalCwds, loadLocal, loadRemote, onOpenChange, t])

  const parentRemotePath = () => {
    if (remotePath === '/' || remotePath === '~') return remotePath
    const idx = remotePath.lastIndexOf('/')
    return idx > 0 ? remotePath.slice(0, idx) : '/'
  }

  const uploadLocalFile = useCallback(
    async (localFilePath: string): Promise<boolean> => {
      if (!connectionId) return false
      const fileName = basenameFromPath(localFilePath)
      const remoteTarget = buildRemoteUploadTarget(fileName, remotePath, selectedRemote)

      const result = await getElectronAPI().ssh.upload(
        connectionId,
        localFilePath,
        remoteTarget,
        (p) => setTransferProgress(p),
      )
      if (!result.ok) {
        toast.error(result.error ?? t('scp.transferFailed'))
      }
      return result.ok
    },
    [connectionId, remotePath, selectedRemote, t],
  )

  const upload = async () => {
    if (!connectionId || !selectedLocal || selectedLocal.isDirectory) {
      toast.message(t('scp.selectLocalFile'))
      return
    }

    setTransferring(true)
    setTransferProgress(null)
    const ok = await uploadLocalFile(selectedLocal.path)
    setTransferring(false)
    setTransferProgress(null)
    if (ok) {
      toast.success(t('scp.uploadSuccess'))
      await loadRemote(remotePath, { afterTransfer: true })
    }
  }

  const uploadDroppedFiles = async (paths: string[]) => {
    if (!connectionId || transferring) return
    if (paths.length === 0) {
      toast.message(t('scp.dropNoFiles'))
      return
    }

    const filePaths: string[] = []
    for (const droppedPath of paths) {
      if (await isLocalDirectory(droppedPath)) {
        toast.message(t('scp.dropDirectorySkipped', { name: basenameFromPath(droppedPath) }))
        continue
      }
      filePaths.push(droppedPath)
    }
    if (filePaths.length === 0) return

    setTransferring(true)
    let successCount = 0
    try {
      for (const localFilePath of filePaths) {
        setTransferProgress(null)
        if (await uploadLocalFile(localFilePath)) successCount++
      }
    } finally {
      setTransferring(false)
      setTransferProgress(null)
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1 ? t('scp.uploadSuccess') : t('scp.uploadBatchSuccess', { count: successCount }),
      )
      await loadRemote(remotePath, { afterTransfer: true })
    }
  }

  const download = async () => {
    if (!connectionId || !selectedRemote || selectedRemote.isDirectory) {
      toast.message(t('scp.selectRemoteFile'))
      return
    }
    const localTarget = selectedLocal?.isDirectory
      ? `${selectedLocal.path.replace(/[/\\]$/, '')}\\${selectedRemote.name}`
      : localPath.includes('\\')
        ? `${localPath}\\${selectedRemote.name}`
        : `${localPath}/${selectedRemote.name}`

    setTransferring(true)
    setTransferProgress(null)
    const result = await getElectronAPI().ssh.download(
      connectionId,
      selectedRemote.path,
      localTarget,
      (p) => setTransferProgress(p),
    )
    setTransferring(false)
    setTransferProgress(null)
    if (result.ok) {
      toast.success(t('scp.downloadSuccess'))
      void loadLocal(localPath)
    } else {
      toast.error(result.error ?? t('scp.transferFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('scp.title', { title: displayTitle })}</DialogTitle>
          <DialogDescription>
            {connection
              ? t('scp.desc', {
                  user: connection.sshUser,
                  host: connection.sshHost,
                })
              : t('scp.descGeneric')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[360px] gap-3">
          <FileListPanel
            title={t('scp.local')}
            path={isScpLocalRoots(localPath) ? t('scp.localComputer') : localPath}
            entries={localEntries}
            loading={localLoading}
            selectedPath={selectedLocal?.path ?? null}
            onSelect={setSelectedLocal}
            onEnterDir={(e) => void loadLocal(e.path)}
            onGoUp={() => void loadLocal(parentScpLocalPath(localPath))}
            onRefresh={() => void loadLocal(localPath)}
            canGoUp={canGoUpScpLocalPath(localPath)}
          />
          <FileListPanel
            title={t('scp.remote')}
            path={remotePath}
            entries={remoteEntries}
            loading={remoteLoading}
            selectedPath={selectedRemote?.path ?? null}
            onSelect={setSelectedRemote}
            onEnterDir={(e) => void loadRemote(e.path)}
            onGoUp={() => void loadRemote(parentRemotePath())}
            onRefresh={() => void loadRemote(remotePath)}
            acceptFileDrop={Boolean(connectionId) && !transferring}
            fileDropActive={remoteDropActive}
            onFileDropActiveChange={setRemoteDropActive}
            onFilesDrop={(paths) => void uploadDroppedFiles(paths)}
          />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="min-h-10 min-w-0 max-w-md flex-1">
            {transferProgress && (
              <div className="flex flex-col gap-1.5">
                <p className="truncate text-xs text-muted-foreground">
                  {transferProgress.direction === 'upload'
                    ? t('scp.uploadingProgress', {
                        name: transferProgress.fileName,
                        percent:
                          transferProgress.total > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (transferProgress.transferred / transferProgress.total) * 100,
                                ),
                              )
                            : 0,
                      })
                    : t('scp.downloadingProgress', {
                        name: transferProgress.fileName,
                        percent:
                          transferProgress.total > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (transferProgress.transferred / transferProgress.total) * 100,
                                ),
                              )
                            : 0,
                      })}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{
                      width:
                        transferProgress.total > 0
                          ? `${Math.min(100, (transferProgress.transferred / transferProgress.total) * 100)}%`
                          : '30%',
                    }}
                  />
                </div>
                {transferProgress.total > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatTransferBytes(transferProgress.transferred)} /{' '}
                    {formatTransferBytes(transferProgress.total)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={transferring || !connectionId}
            onClick={() => void upload()}
          >
            <ArrowUp className="size-4" />
            {t('scp.upload')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={transferring || !connectionId}
            onClick={() => void download()}
          >
            <ArrowDown className="size-4" />
            {t('scp.download')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
