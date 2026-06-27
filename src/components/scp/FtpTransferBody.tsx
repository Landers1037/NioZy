import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getElectronAPI } from '@/lib/electron-client'
import { basenameFromPath } from '@/lib/path-utils'
import {
  canGoUpScpLocalPath,
  initialScpLocalPath,
  isScpLocalRoots,
  parentScpLocalPath,
  SCP_LOCAL_ROOTS,
} from '@/lib/scp-local-path'
import { buildRemoteUploadTarget, isLocalDirectory } from '@/lib/scp-transfer-actions'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { ScpFileEntry, ScpTransferProgress } from '../../../electron/shared/api-types'
import type { ScpListRemoteOptions } from '../../../electron/shared/ssh-types'
import { FileListPanel } from './SftpTransferBody'

interface FtpTransferBodyProps {
  connectionId: string
  className?: string
}

interface TransferRecord {
  id: string
  time: string
  direction: 'upload' | 'download'
  source: string
  target: string
  size?: number
  transferred: number
  total: number
  progressText: string
  status: 'running' | 'success' | 'failed'
  error?: string
}

function formatTransferBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatProgressText(record: Pick<TransferRecord, 'status' | 'transferred' | 'total'>): string {
  if (record.status === 'success') return '100%'
  if (record.status === 'failed') return '--'
  if (record.total > 0) return `${Math.min(100, Math.round((record.transferred / record.total) * 100))}%`
  if (record.transferred > 0) return formatTransferBytes(record.transferred)
  return '--'
}

function buildLocalDownloadTarget(
  localPath: string,
  selectedLocal: ScpFileEntry | null,
  remoteName: string,
): string {
  if (selectedLocal?.isDirectory) {
    return `${selectedLocal.path.replace(/[/\\]$/, '')}\\${remoteName}`
  }
  return localPath.includes('\\') ? `${localPath}\\${remoteName}` : `${localPath}/${remoteName}`
}

export function FtpTransferBody({ connectionId, className }: FtpTransferBodyProps) {
  const { t } = useTranslation()
  const terminalCwds = useAppStore((s) => s.terminalCwds)

  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('/')
  const [localEntries, setLocalEntries] = useState<ScpFileEntry[]>([])
  const [remoteEntries, setRemoteEntries] = useState<ScpFileEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedLocal, setSelectedLocal] = useState<ScpFileEntry | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<ScpFileEntry | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [remoteDropActive, setRemoteDropActive] = useState(false)
  const [profileError, setProfileError] = useState(false)
  const [records, setRecords] = useState<TransferRecord[]>([])
  const remoteListQueue = useRef<Promise<unknown>>(Promise.resolve())
  const activeRecordIdRef = useRef<string | null>(null)

  const loadLocal = useCallback(async (dir: string) => {
    setLocalLoading(true)
    try {
      if (isScpLocalRoots(dir)) {
        setLocalPath(SCP_LOCAL_ROOTS)
        const result = await getElectronAPI().files.listRoots()
        if (result.ok && result.entries) setLocalEntries(result.entries)
        else toast.error(result.error ?? t('scp.listFailed'))
        return
      }

      setLocalPath(dir)
      const result = await getElectronAPI().ssh.listLocal(dir)
      if (result.ok && result.entries) setLocalEntries(result.entries)
      else toast.error(result.error ?? t('scp.listFailed'))
    } finally {
      setLocalLoading(false)
    }
  }, [t])

  const loadRemote = useCallback(
    (dir: string, options?: ScpListRemoteOptions) => {
      if (!connectionId) return Promise.resolve(false)

      const run = async (): Promise<boolean> => {
        setRemoteLoading(true)
        let ok = false
        try {
          const result = await getElectronAPI().ftp.listRemote(connectionId, dir, options)
          if (result.ok && result.entries) {
            setRemoteEntries(result.entries)
            setRemotePath(result.resolvedPath ?? dir)
            ok = true
          } else if (!options?.afterTransfer) {
            toast.error(result.error ?? t('scp.listFailed'))
          } else {
            toast.message(t('scp.refreshAfterTransferFailed'))
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (!options?.afterTransfer) toast.error(message || t('scp.listFailed'))
        } finally {
          setRemoteLoading(false)
        }
        return ok
      }

      const next = remoteListQueue.current.then(run, run)
      remoteListQueue.current = next
      return next
    },
    [connectionId, t],
  )

  useEffect(() => {
    if (!connectionId) return
    let cancelled = false

    void (async () => {
      const profile = await getElectronAPI().ftp.getProfile(connectionId)
      if (cancelled) return
      if (!profile) {
        toast.error(t('ftp.profileFailed'))
        setProfileError(true)
        return
      }
      setProfileError(false)
      const initialLocal = initialScpLocalPath(undefined, terminalCwds, true)
      setLocalPath(initialLocal)
      setRemotePath('/')
      setSelectedLocal(null)
      setSelectedRemote(null)
      await loadLocal(initialLocal)
      if (!cancelled) await loadRemote('/')
    })()

    return () => {
      cancelled = true
    }
  }, [connectionId, loadLocal, loadRemote, t, terminalCwds])

  const parentRemotePath = () => {
    if (remotePath === '/') return '/'
    const idx = remotePath.lastIndexOf('/')
    return idx > 0 ? remotePath.slice(0, idx) : '/'
  }

  const startRecord = (
    input: Pick<TransferRecord, 'direction' | 'source' | 'target' | 'size'>,
  ): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    activeRecordIdRef.current = id
    const record: TransferRecord = {
      id,
      time: new Date().toLocaleString(),
      direction: input.direction,
      source: input.source,
      target: input.target,
      size: input.size,
      transferred: 0,
      total: input.size ?? 0,
      progressText: '--',
      status: 'running',
    }
    setRecords((prev) => [record, ...prev].slice(0, 100))
    return id
  }

  const updateRecordProgress = (progress: ScpTransferProgress) => {
    const recordId = activeRecordIdRef.current
    if (!recordId) return
    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record
        const next = {
          ...record,
          size: progress.total > 0 ? progress.total : record.size,
          transferred: progress.transferred,
          total: progress.total,
        }
        return { ...next, progressText: formatProgressText(next) }
      }),
    )
  }

  const finishRecord = (ok: boolean, error?: string) => {
    const recordId = activeRecordIdRef.current
    activeRecordIdRef.current = null
    if (!recordId) return
    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record
        const next = {
          ...record,
          status: ok ? 'success' as const : 'failed' as const,
          error,
          transferred: ok && record.total > 0 ? record.total : record.transferred,
        }
        return { ...next, progressText: formatProgressText(next) }
      }),
    )
  }

  const uploadLocalFile = useCallback(
    async (localFilePath: string): Promise<boolean> => {
      const fileName = basenameFromPath(localFilePath)
      const remoteTarget = buildRemoteUploadTarget(fileName, remotePath, selectedRemote)
      startRecord({
        direction: 'upload',
        source: localFilePath,
        target: remoteTarget,
      })
      const result = await getElectronAPI().ftp.upload(
        connectionId,
        localFilePath,
        remoteTarget,
        updateRecordProgress,
      )
      finishRecord(result.ok, result.error)
      if (!result.ok) toast.error(result.error ?? t('scp.transferFailed'))
      return result.ok
    },
    [connectionId, remotePath, selectedRemote, t],
  )

  const upload = async () => {
    if (!selectedLocal || selectedLocal.isDirectory) {
      toast.message(t('scp.selectLocalFile'))
      return
    }
    setTransferring(true)
    const ok = await uploadLocalFile(selectedLocal.path)
    setTransferring(false)
    if (ok) {
      toast.success(t('scp.uploadSuccess'))
      await loadRemote(remotePath, { afterTransfer: true })
    }
  }

  const uploadDroppedFiles = async (paths: string[]) => {
    if (transferring) return
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
        if (await uploadLocalFile(localFilePath)) successCount++
      }
    } finally {
      setTransferring(false)
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1 ? t('scp.uploadSuccess') : t('scp.uploadBatchSuccess', { count: successCount }),
      )
      await loadRemote(remotePath, { afterTransfer: true })
    }
  }

  const download = async () => {
    if (!selectedRemote) {
      toast.message(t('scp.selectRemoteFile'))
      return
    }
    if (isScpLocalRoots(localPath) && !selectedLocal?.isDirectory) {
      toast.message(t('ftp.selectLocalTarget'))
      return
    }
    const localTarget = buildLocalDownloadTarget(localPath, selectedLocal, selectedRemote.name)
    startRecord({
      direction: 'download',
      source: selectedRemote.path,
      target: localTarget,
      size: selectedRemote.size,
    })

    setTransferring(true)
    const result = selectedRemote.isDirectory
      ? await getElectronAPI().ftp.downloadDirectory(
          connectionId,
          selectedRemote.path,
          localTarget,
          updateRecordProgress,
        )
      : await getElectronAPI().ftp.download(
          connectionId,
          selectedRemote.path,
          localTarget,
          updateRecordProgress,
        )
    setTransferring(false)
    finishRecord(result.ok, result.error)

    if (result.ok) {
      toast.success(
        selectedRemote.isDirectory ? t('ftp.downloadDirectorySuccess') : t('scp.downloadSuccess'),
      )
      void loadLocal(localPath)
      return
    }
    toast.error(result.error ?? t('scp.transferFailed'))
  }

  if (profileError) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {t('ftp.profileFailed')}
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex min-h-[320px] flex-[3] gap-3">
        <FileListPanel
          title={t('scp.local')}
          path={isScpLocalRoots(localPath) ? t('scp.localComputer') : localPath}
          entries={localEntries}
          loading={localLoading}
          selectedPath={selectedLocal?.path ?? null}
          onSelect={setSelectedLocal}
          onEnterDir={(entry) => void loadLocal(entry.path)}
          onGoUp={() => void loadLocal(parentScpLocalPath(localPath))}
          onRefresh={() => void loadLocal(localPath)}
          canGoUp={canGoUpScpLocalPath(localPath)}
        />
        <FileListPanel
          title={t('ftp.remote')}
          path={remotePath}
          entries={remoteEntries}
          loading={remoteLoading}
          selectedPath={selectedRemote?.path ?? null}
          onSelect={setSelectedRemote}
          onEnterDir={(entry) => void loadRemote(entry.path)}
          onGoUp={() => void loadRemote(parentRemotePath())}
          onRefresh={() => void loadRemote(remotePath)}
          editablePath
          onNavigatePath={loadRemote}
          acceptFileDrop={!transferring}
          fileDropActive={remoteDropActive}
          onFileDropActiveChange={setRemoteDropActive}
          onFilesDrop={(paths) => void uploadDroppedFiles(paths)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          {transferring ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              {t('ftp.transferring')}
            </span>
          ) : (
            t('ftp.transferIdle')
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={transferring} onClick={() => void upload()}>
            <ArrowUp className="size-4" />
            {t('scp.upload')}
          </Button>
          <Button type="button" variant="outline" disabled={transferring} onClick={() => void download()}>
            <ArrowDown className="size-4" />
            {selectedRemote?.isDirectory ? t('ftp.downloadDirectory') : t('scp.download')}
          </Button>
        </div>
      </div>

      <div className="flex min-h-[220px] flex-[2] flex-col rounded-lg border border-border bg-muted/20">
        <div className="grid grid-cols-[150px_1.2fr_1.2fr_110px_110px_110px] gap-3 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>{t('ftp.transferTime')}</span>
          <span>{t('ftp.transferSource')}</span>
          <span>{t('ftp.transferTarget')}</span>
          <span>{t('ftp.transferProgress')}</span>
          <span>{t('ftp.transferSize')}</span>
          <span>{t('ftp.transferStatus')}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
              {t('ftp.transferEmpty')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="grid grid-cols-[150px_1.2fr_1.2fr_110px_110px_110px] gap-3 px-3 py-2 text-xs"
                >
                  <span className="truncate text-muted-foreground">{record.time}</span>
                  <span className="truncate font-mono" title={record.source}>
                    {record.source}
                  </span>
                  <span className="truncate font-mono" title={record.target}>
                    {record.target}
                  </span>
                  <span className="truncate">
                    {record.progressText}
                    {record.total > 0 ? ` (${formatTransferBytes(record.transferred)} / ${formatTransferBytes(record.total)})` : ''}
                  </span>
                  <span>{formatTransferBytes(record.size)}</span>
                  <span
                    className={cn(
                      'truncate',
                      record.status === 'success' && 'text-emerald-600',
                      record.status === 'failed' && 'text-red-600',
                      record.status === 'running' && 'text-amber-600',
                    )}
                    title={record.error}
                  >
                    {record.status === 'success'
                      ? t('ftp.transferStatusSuccess')
                      : record.status === 'failed'
                        ? t('ftp.transferStatusFailed')
                        : t('ftp.transferStatusRunning')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
