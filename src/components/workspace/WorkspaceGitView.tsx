import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDiff, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspaceSession, useWorkspaceStore } from '@/stores/workspace-store'
import { WorkspaceDiffDialog } from '@/components/workspace/WorkspaceDiffDialog'
import type { WorkspaceGitFile, WorkspaceGitFileStatus } from '../../../electron/shared/workspace-types'
import { cn } from '@/lib/utils'

const STATUS_ORDER: WorkspaceGitFileStatus[] = ['added', 'modified', 'deleted']

interface WorkspaceGitViewProps {
  tabId: string
}

export function WorkspaceGitView({ tabId }: WorkspaceGitViewProps) {
  const { t } = useTranslation()
  const session = useWorkspaceSession(tabId)
  const refreshGitStatus = useWorkspaceStore((s) => s.refreshGitStatus)
  const detectGitSupport = useWorkspaceStore((s) => s.detectGitSupport)

  const [diffFile, setDiffFile] = useState<string | null>(null)

  useEffect(() => {
    void detectGitSupport(tabId)
    void refreshGitStatus(tabId)
  }, [detectGitSupport, refreshGitStatus, tabId, session.workingDir])

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

  const handleRefresh = useCallback(() => {
    void detectGitSupport(tabId)
    void refreshGitStatus(tabId)
  }, [detectGitSupport, refreshGitStatus, tabId])

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
      <div className="flex shrink-0 items-center justify-end border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={handleRefresh}>
          <RefreshCw className={cn('size-3.5', session.gitLoading && 'animate-spin')} />
        </Button>
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
                        onClick={() => {
                          if (status !== 'deleted') setDiffFile(file.path)
                        }}
                      >
                        <FileDiff className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {status === 'added'
                            ? `+${file.additions || '?'}`
                            : status === 'deleted'
                              ? `-${file.deletions || '?'}`
                              : `+${file.additions} -${file.deletions}`}
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
    </div>
  )
}
