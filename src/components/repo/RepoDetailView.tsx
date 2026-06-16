import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getElectronAPI } from '@/lib/electron-client'
import type { GitCommitDetail, ManagedRepo } from '../../../electron/shared/repo-types'
import { CommitDetailPanel } from './CommitDetailPanel'
import { GitGraphView } from './GitGraphView'

interface RepoDetailViewProps {
  repoId: string
  onBack: () => void
}

export function RepoDetailView({ repoId, onBack }: RepoDetailViewProps) {
  const { t } = useTranslation()
  const [repo, setRepo] = useState<ManagedRepo | null>(null)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [graphKey, setGraphKey] = useState(0)

  useEffect(() => {
    void getElectronAPI()
      .repo.getById(repoId)
      .then((r) => setRepo(r))
  }, [repoId])

  const loadCommitDetail = useCallback(
    async (sha: string) => {
      setSelectedSha(sha)
      setDetailLoading(true)
      setDetailError(null)
      setCommitDetail(null)
      try {
        const result = await getElectronAPI().repo.getCommitDetail(repoId, sha)
        if ('error' in result) {
          setCommitDetail(null)
          setDetailError(result.error)
        } else {
          setCommitDetail(result)
        }
      } catch (err: unknown) {
        setCommitDetail(null)
        setDetailError(err instanceof Error ? err.message : String(err))
      } finally {
        setDetailLoading(false)
      }
    },
    [repoId],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t('repo.backToList')}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{repo?.displayName ?? repo?.path ?? repoId}</p>
          {repo?.path ? (
            <p className="truncate font-mono text-xs text-muted-foreground">{repo.path}</p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => setGraphKey((k) => k + 1)}>
          <RefreshCw className="size-4" />
          {t('repo.refreshGraph')}
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,36%)]">
        <div className="min-h-0 p-2">
          <GitGraphView
            key={graphKey}
            repoId={repoId}
            selectedSha={selectedSha}
            onSelectCommit={(sha) => void loadCommitDetail(sha)}
          />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden border-t border-border md:border-t-0 md:border-l">
          <CommitDetailPanel
            repoId={repoId}
            detail={commitDetail}
            loading={detailLoading}
            error={detailError}
            selectedSha={selectedSha}
          />
        </div>
      </div>
    </div>
  )
}
