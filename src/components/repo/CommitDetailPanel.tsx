import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getElectronAPI } from '@/lib/electron-client'
import type { GitCommitDetail, GitCommitFileChange } from '../../../electron/shared/repo-types'
import { cn } from '@/lib/utils'
import { CommitFileDiffView } from './CommitFileDiffView'

interface CommitDetailPanelProps {
  repoId: string
  detail: GitCommitDetail | null
  loading: boolean
  error?: string | null
  selectedSha?: string | null
}

const STATUS_LABEL: Record<GitCommitFileChange['status'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  unknown: '?',
}

const STATUS_CLASS: Record<GitCommitFileChange['status'], string> = {
  added: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  modified: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  deleted: 'bg-red-500/15 text-red-700 dark:text-red-300',
  renamed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  copied: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  unknown: 'bg-muted text-muted-foreground',
}

export function CommitDetailPanel({
  repoId,
  detail,
  loading,
  error = null,
  selectedSha = null,
}: CommitDetailPanelProps) {
  const { t } = useTranslation()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPath(null)
    setDiffText(null)
    setDiffError(null)
    setDiffLoading(false)
  }, [detail?.sha])

  const loadFileDiff = useCallback(
    async (filePath: string) => {
      if (!detail) return
      setSelectedPath(filePath)
      setDiffLoading(true)
      setDiffError(null)
      setDiffText(null)
      try {
        const api = getElectronAPI().repo
        if (typeof api.getCommitFileDiff !== 'function') {
          setDiffError(t('repo.diffApiMissing'))
          setDiffLoading(false)
          return
        }
        const result = await api.getCommitFileDiff(repoId, detail.sha, filePath)
        if ('error' in result) {
          setDiffError(result.error)
          setDiffLoading(false)
          return
        }
        setDiffText(result.diff || t('repo.diffEmpty'))
        setDiffLoading(false)
      } catch (err: unknown) {
        setDiffError(err instanceof Error ? err.message : String(err))
        setDiffLoading(false)
      }
    },
    [repoId, detail, t],
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('repo.loadingCommit')}
      </div>
    )
  }

  if (error && selectedSha) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm">
        <p className="font-medium text-destructive">{t('repo.commitDetailError')}</p>
        <p className="font-mono text-xs text-muted-foreground">{selectedSha.slice(0, 7)}</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        {t('repo.selectCommitHint')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{detail.shortSha}</p>
          <h3 className="mt-1 text-sm font-semibold">{detail.subject}</h3>
          {detail.body ? (
            <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {detail.body}
            </pre>
          ) : null}
        </div>
        <dl className="grid gap-1 text-xs">
          <div>
            <dt className="text-muted-foreground">{t('repo.commitAuthor')}</dt>
            <dd>{detail.author}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('repo.commitDate')}</dt>
            <dd>{new Date(detail.date).toLocaleString()}</dd>
          </div>
          {detail.parents.length > 0 && (
            <div>
              <dt className="text-muted-foreground">{t('repo.commitParents')}</dt>
              <dd className="font-mono">{detail.parents.map((p) => p.slice(0, 7)).join(', ')}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="shrink-0 px-4 pb-2 pt-3 text-xs font-medium">
          {t('repo.changedFiles')}
          {detail.files.length > 0 ? ` (${detail.files.length})` : ''}
        </p>

        {detail.files.length === 0 ? (
          <p className="px-4 text-xs text-muted-foreground">{t('repo.noChangedFiles')}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <ul className="space-y-1">
              {detail.files.map((file) => {
                const selected = selectedPath === file.path
                return (
                  <li key={file.path} className="rounded-md border border-border/60">
                    <button
                      type="button"
                      onClick={() => void loadFileDiff(file.path)}
                      className={cn(
                        'flex w-full items-start gap-2 px-2 py-2 text-left text-xs transition-colors hover:bg-muted/50',
                        selected && 'bg-primary/10',
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform',
                          selected && 'rotate-90 text-primary',
                        )}
                      />
                      <span
                        className={cn(
                          'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
                          STATUS_CLASS[file.status],
                        )}
                        title={t(`repo.fileStatus.${file.status}`)}
                      >
                        {STATUS_LABEL[file.status]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-all font-mono">{file.path}</span>
                        {file.oldPath ? (
                          <span className="mt-0.5 block break-all font-mono text-muted-foreground">
                            ← {file.oldPath}
                          </span>
                        ) : null}
                        <span className="mt-1 block tabular-nums text-muted-foreground">
                          +{file.additions} -{file.deletions}
                        </span>
                      </span>
                    </button>
                    {selected ? (
                      <div className="border-t border-border/60 p-2">
                        {diffLoading ? (
                          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            {t('repo.loadingDiff')}
                          </div>
                        ) : diffError ? (
                          <p className="py-2 text-xs text-destructive">{diffError}</p>
                        ) : (
                          <CommitFileDiffView diff={diffText ?? ''} />
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
