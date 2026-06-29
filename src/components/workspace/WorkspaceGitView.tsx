import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDiff, GitBranch, Loader2, RefreshCw, Send, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspaceSession, useWorkspaceStore } from '@/stores/workspace-store'
import { WorkspaceDiffDialog } from '@/components/workspace/WorkspaceDiffDialog'
import type { WorkspaceGitFile, WorkspaceGitFileStatus } from '../../../electron/shared/workspace-types'
import { cn } from '@/lib/utils'
import { getElectronAPI } from '@/lib/electron-client'

const STATUS_ORDER: WorkspaceGitFileStatus[] = ['added', 'modified', 'deleted']

interface WorkspaceGitViewProps {
  tabId: string
}

export function WorkspaceGitView({ tabId }: WorkspaceGitViewProps) {
  const { t } = useTranslation()
  const session = useWorkspaceSession(tabId)
  const refreshGitStatus = useWorkspaceStore((s) => s.refreshGitStatus)
  const refreshGitBranch = useWorkspaceStore((s) => s.refreshGitBranch)
  const detectGitSupport = useWorkspaceStore((s) => s.detectGitSupport)

  const [diffFile, setDiffFile] = useState<string | null>(null)
  const [commitOpen, setCommitOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<string[]>([])
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)

  useEffect(() => {
    void detectGitSupport(tabId)
    void refreshGitBranch(tabId)
    void refreshGitStatus(tabId)
  }, [detectGitSupport, refreshGitBranch, refreshGitStatus, tabId, session.workingDir])

  const grouped = useMemo(() => {
    const map: Record<WorkspaceGitFileStatus, WorkspaceGitFile[]> = {
      added: [],
      modified: [],
      deleted: [],
    }
    for (const file of session.gitFiles) {
      map[file.status].push(file)
    }
    return map
  }, [session.gitFiles])

  useEffect(() => {
    if (!commitOpen) return
    setSelectedCommitFiles(session.gitFiles.map((file) => file.path))
  }, [commitOpen, session.gitFiles])

  const handleRefresh = useCallback(() => {
    void detectGitSupport(tabId)
    void refreshGitBranch(tabId)
    void refreshGitStatus(tabId)
  }, [detectGitSupport, refreshGitBranch, refreshGitStatus, tabId])

  const handleCommit = useCallback(async () => {
    const message = commitMessage.trim()
    if (!message || !session.workingDir) return
    setCommitting(true)
    try {
      const result = await getElectronAPI().workspace.gitCommit(
        session.workingDir,
        message,
        selectedCommitFiles,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.output)
      setCommitOpen(false)
      setCommitMessage('')
      setSelectedCommitFiles([])
      void refreshGitBranch(tabId)
      void refreshGitStatus(tabId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCommitting(false)
    }
  }, [
    commitMessage,
    refreshGitBranch,
    refreshGitStatus,
    selectedCommitFiles,
    session.workingDir,
    tabId,
  ])

  const handlePush = useCallback(async () => {
    if (!session.workingDir) return
    setPushing(true)
    try {
      const result = await getElectronAPI().workspace.gitPush(session.workingDir)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.output)
      void refreshGitBranch(tabId)
      void refreshGitStatus(tabId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setPushing(false)
    }
  }, [refreshGitBranch, refreshGitStatus, session.workingDir, tabId])

  if (session.gitSupported === false || session.gitError === 'GIT_NOT_FOUND') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p>{t('workspace.gitNotSupported')}</p>
      </div>
    )
  }

  if (session.gitError === 'NOT_GIT_REPO') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p>{t('workspace.notGitRepo')}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            <GitBranch className="size-3 shrink-0" />
            <span className="truncate">{session.gitBranch ?? t('workspace.branchUnknown')}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCommitOpen(true)}>
            <Send className="mr-1 size-3.5" />
            {t('workspace.commit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void handlePush()}
            disabled={pushing}
          >
            {pushing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 size-3.5" />
            )}
            {t('workspace.push')}
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleRefresh}>
            <RefreshCw className={cn('size-3.5', session.gitLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {session.gitLoading && session.gitFiles.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : session.gitFiles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('workspace.gitClean')}</p>
        ) : (
          STATUS_ORDER.map((status) => {
            const files = grouped[status]
            if (files.length === 0) return null
            return (
              <section key={status} className="mb-4">
                <h3 className="mb-2 text-xs font-app-bold uppercase tracking-wide text-muted-foreground">
                  {t(`workspace.fileStatus.${status}`)}
                </h3>
                <ul className="space-y-1">
                  {files.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => setDiffFile(file.path)}
                      >
                        <FileDiff className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                        <span className="shrink-0 font-mono text-xs text-emerald-600 dark:text-emerald-300">
                          +{file.additions}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-red-600 dark:text-red-300">
                          -{file.deletions}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </div>

      {diffFile && (
        <WorkspaceDiffDialog
          tabId={tabId}
          filePath={diffFile}
          open={Boolean(diffFile)}
          onOpenChange={(open) => {
            if (!open) setDiffFile(null)
          }}
        />
      )}

      <Dialog
        open={commitOpen}
        onOpenChange={(open) => {
          setCommitOpen(open)
          if (!open && !committing) {
            setCommitMessage('')
            setSelectedCommitFiles([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspace.commitTitle')}</DialogTitle>
            <DialogDescription>{t('workspace.commitDesc')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.currentTarget.value)}
            placeholder={t('workspace.commitPlaceholder')}
            rows={5}
            autoFocus
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="text-sm font-app-bold">{t('workspace.commitFiles')}</span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setSelectedCommitFiles((current) =>
                    current.length === session.gitFiles.length
                      ? []
                      : session.gitFiles.map((file) => file.path),
                  )
                }}
              >
                {selectedCommitFiles.length === session.gitFiles.length
                  ? t('workspace.unselectAll')
                  : t('workspace.selectAll')}
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {session.gitFiles.map((file) => {
                const checked = selectedCommitFiles.includes(file.path)
                return (
                  <label
                    key={file.path}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      onChange={(e) => {
                        const nextChecked = e.currentTarget.checked
                        setSelectedCommitFiles((current) =>
                          nextChecked
                            ? [...current, file.path]
                            : current.filter((path) => path !== file.path),
                        )
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                      {t(`workspace.fileStatus.${file.status}`)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitOpen(false)} disabled={committing}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleCommit()}
              disabled={committing || !commitMessage.trim() || selectedCommitFiles.length === 0}
            >
              {committing ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
              {t('workspace.commit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
