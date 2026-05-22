import { useCallback, useEffect, useState } from 'react'
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
import { getSshConnection } from '@/lib/ssh-connection'
import { getTabDisplayTitle } from '@/lib/tab-display'
import type { ScpFileEntry, SshConnectionProfile } from '../../../electron/shared/api-types'
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
}) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-muted/30">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{title}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={path}>
          {path}
        </span>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onGoUp}>
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
    </div>
  )
}

export function ScpTransferDialog({ tab, open, onOpenChange }: ScpTransferDialogProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const terminalCwds = useAppStore((s) => s.terminalCwds)

  const [profile, setProfile] = useState<SshConnectionProfile | null>(null)
  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('~')
  const [localEntries, setLocalEntries] = useState<ScpFileEntry[]>([])
  const [remoteEntries, setRemoteEntries] = useState<ScpFileEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedLocal, setSelectedLocal] = useState<ScpFileEntry | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<ScpFileEntry | null>(null)
  const [transferring, setTransferring] = useState(false)

  const connection = getSshConnection(settings, tab.sshConnectionId)
  const displayTitle = getTabDisplayTitle(tab)

  const loadLocal = useCallback(async (dir: string) => {
    setLocalLoading(true)
    setLocalPath(dir)
    const result = await getElectronAPI().ssh.listLocal(dir)
    setLocalLoading(false)
    if (result.ok && result.entries) {
      setLocalEntries(result.entries)
      if (!dir && result.entries.length > 0) {
        const parent = result.entries[0]!.path.replace(/[/\\][^/\\]+$/, '')
        if (parent) setLocalPath(parent)
      }
    } else {
      toast.error(result.error ?? t('scp.listFailed'))
    }
  }, [t])

  const loadRemote = useCallback(
    async (dir: string, prof: SshConnectionProfile) => {
      setRemoteLoading(true)
      const result = await getElectronAPI().ssh.listRemote(prof, dir)
      setRemoteLoading(false)
      if (result.ok && result.entries) {
        setRemoteEntries(result.entries)
        setRemotePath(dir)
      } else {
        toast.error(result.error ?? t('scp.listFailed'))
      }
    },
    [t],
  )

  useEffect(() => {
    if (!open || !tab.sshConnectionId) return
    let cancelled = false

    void (async () => {
      const prof = await getElectronAPI().ssh.getProfile(tab.sshConnectionId!)
      if (cancelled) return
      if (!prof) {
        toast.error(t('scp.profileFailed'))
        onOpenChange(false)
        return
      }
      if (connection?.sshAuth === 'password') {
        toast.message(t('scp.passwordAuthHint'))
      }
      setProfile(prof)
      const initialLocal = (tab.terminalId && terminalCwds[tab.terminalId]) || ''
      setLocalPath(initialLocal)
      setRemotePath('~')
      setSelectedLocal(null)
      setSelectedRemote(null)
      await loadLocal(initialLocal)
      if (!cancelled) await loadRemote('~', prof)
    })()

    return () => {
      cancelled = true
    }
  }, [open, tab.sshConnectionId, tab.terminalId, terminalCwds, connection?.sshAuth, loadLocal, loadRemote, onOpenChange, t])

  const parentLocalPath = () => {
    const sep = localPath.includes('\\') ? '\\' : '/'
    const idx = localPath.lastIndexOf(sep)
    return idx > 0 ? localPath.slice(0, idx) : localPath
  }

  const parentRemotePath = () => {
    if (remotePath === '/' || remotePath === '~') return remotePath
    const idx = remotePath.lastIndexOf('/')
    return idx > 0 ? remotePath.slice(0, idx) : '/'
  }

  const upload = async () => {
    if (!profile || !selectedLocal || selectedLocal.isDirectory) {
      toast.message(t('scp.selectLocalFile'))
      return
    }
    const remoteTarget = selectedRemote?.isDirectory
      ? `${selectedRemote.path.replace(/\/$/, '')}/${selectedLocal.name}`
      : remotePath.endsWith('/')
        ? `${remotePath}${selectedLocal.name}`
        : `${remotePath}/${selectedLocal.name}`

    setTransferring(true)
    const result = await getElectronAPI().ssh.upload(profile, selectedLocal.path, remoteTarget)
    setTransferring(false)
    if (result.ok) {
      toast.success(t('scp.uploadSuccess'))
      void loadRemote(remotePath, profile)
    } else {
      toast.error(result.error ?? t('scp.transferFailed'))
    }
  }

  const download = async () => {
    if (!profile || !selectedRemote || selectedRemote.isDirectory) {
      toast.message(t('scp.selectRemoteFile'))
      return
    }
    const localTarget = selectedLocal?.isDirectory
      ? `${selectedLocal.path.replace(/[/\\]$/, '')}\\${selectedRemote.name}`
      : localPath.includes('\\')
        ? `${localPath}\\${selectedRemote.name}`
        : `${localPath}/${selectedRemote.name}`

    setTransferring(true)
    const result = await getElectronAPI().ssh.download(
      profile,
      selectedRemote.path,
      localTarget,
    )
    setTransferring(false)
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
            path={localPath}
            entries={localEntries}
            loading={localLoading}
            selectedPath={selectedLocal?.path ?? null}
            onSelect={setSelectedLocal}
            onEnterDir={(e) => void loadLocal(e.path)}
            onGoUp={() => void loadLocal(parentLocalPath())}
            onRefresh={() => void loadLocal(localPath)}
          />
          <FileListPanel
            title={t('scp.remote')}
            path={remotePath}
            entries={remoteEntries}
            loading={remoteLoading}
            selectedPath={selectedRemote?.path ?? null}
            onSelect={setSelectedRemote}
            onEnterDir={(e) => profile && void loadRemote(e.path, profile)}
            onGoUp={() => profile && void loadRemote(parentRemotePath(), profile)}
            onRefresh={() => profile && void loadRemote(remotePath, profile)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={transferring || !profile}
            onClick={() => void upload()}
          >
            <ArrowUp className="size-4" />
            {t('scp.upload')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={transferring || !profile}
            onClick={() => void download()}
          >
            <ArrowDown className="size-4" />
            {t('scp.download')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
