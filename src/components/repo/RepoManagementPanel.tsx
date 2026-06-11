import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { AnimatedPanelSwap } from '@/components/ui/animated-panel-section'
import { RepoListView } from './RepoListView'
import { RepoDetailView } from './RepoDetailView'

export function RepoManagementPanel() {
  const { t } = useTranslation()
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [detailRepoId, setDetailRepoId] = useState<string | null>(null)
  const [gitMissing, setGitMissing] = useState(false)

  useEffect(() => {
    if (!isElectron()) return
    void getElectronAPI()
      .repo.detectGit()
      .then((r) => setGitMissing(!r.found))
  }, [])

  const openRepo = (repoId: string) => {
    setDetailRepoId(repoId)
    setView('detail')
  }

  const backToList = () => {
    setView('list')
    setDetailRepoId(null)
  }

  const activeKey = view === 'list' ? 'list' : detailRepoId ? `detail:${detailRepoId}` : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-background select-none">
      {gitMissing && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          {t('repo.gitNotFoundBanner')}
        </div>
      )}
      <AnimatedPanelSwap activeKey={activeKey}>
        {(key) =>
          key === 'list' ? (
            <RepoListView onOpenRepo={openRepo} />
          ) : (
            <RepoDetailView repoId={detailRepoId!} onBack={backToList} />
          )
        }
      </AnimatedPanelSwap>
    </div>
  )
}
