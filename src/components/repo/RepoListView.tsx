import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedLoadingSwap } from '@/components/ui/animated-panel-section'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getElectronAPI } from '@/lib/electron-client'
import type { ManagedRepoSummary } from '../../../electron/shared/repo-types'
import { RepoCard } from './RepoCard'
import { BranchSwitchDialog } from './BranchSwitchDialog'
import { RepoPullOverlay } from './RepoPullOverlay'

interface RepoListViewProps {
  onOpenRepo: (repoId: string) => void
}

export function RepoListView({ onOpenRepo }: RepoListViewProps) {
  const { t } = useTranslation()
  const [repos, setRepos] = useState<ManagedRepoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pullingRepo, setPullingRepo] = useState<ManagedRepoSummary | null>(null)
  const [branchDialogRepoId, setBranchDialogRepoId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ManagedRepoSummary | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await getElectronAPI().repo.listManaged()
    setRepos(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleAdd = async () => {
    const path = await getElectronAPI().repo.pickDirectory()
    if (!path) return
    const validation = await getElectronAPI().repo.validateRepo(path)
    if (!validation.ok) {
      toast.error(t('repo.notGitRepo'))
      return
    }
    const result = await getElectronAPI().repo.add(path)
    if ('error' in result && result.error === 'DUPLICATE') {
      toast.error(t('repo.duplicateRepo'))
      return
    }
    if ('ok' in result && result.ok === false) {
      toast.error(t('repo.notGitRepo'))
      return
    }
    if ('repo' in result && result.ok) {
      toast.success(t('repo.addSuccess'))
      void refresh()
    }
  }

  const handlePull = async (repo: ManagedRepoSummary) => {
    setPullingRepo(repo)
    setBusyId(repo.id)
    try {
      const result = await getElectronAPI().repo.pull(repo.id)
      if (!result.ok) {
        toast.error(result.error ?? t('repo.pullFailed'))
        return
      }
      toast.success(t('repo.pullSuccess'))
      void refresh()
    } finally {
      setPullingRepo(null)
      setBusyId(null)
    }
  }

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return
    setBusyId(removeTarget.id)
    await getElectronAPI().repo.remove(removeTarget.id)
    setBusyId(null)
    setRemoveTarget(null)
    toast.success(t('repo.removeSuccess'))
    void refresh()
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 p-4">
      {pullingRepo ? <RepoPullOverlay repoName={pullingRepo.name} /> : null}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('repo.listTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('repo.listDesc')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="size-4" />
            {t('repo.refresh')}
          </Button>
          <Button size="sm" onClick={() => void handleAdd()}>
            <Plus className="size-4" />
            {t('repo.add')}
          </Button>
        </div>
      </div>

      <AnimatedLoadingSwap
        loading={loading}
        className="min-h-0"
        loadingContent={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('common.loading')}
          </div>
        }
      >
        {repos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <p>{t('repo.empty')}</p>
            <Button onClick={() => void handleAdd()}>{t('repo.addFirst')}</Button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {repos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                busy={busyId === repo.id}
                onOpen={() => onOpenRepo(repo.id)}
                onPull={() => void handlePull(repo)}
                onSwitchBranch={() => setBranchDialogRepoId(repo.id)}
                onRemove={() => setRemoveTarget(repo)}
              />
            ))}
          </div>
        )}
      </AnimatedLoadingSwap>

      <BranchSwitchDialog
        repoId={branchDialogRepoId ?? ''}
        open={branchDialogRepoId != null}
        onOpenChange={(open) => {
          if (!open) setBranchDialogRepoId(null)
        }}
        onSuccess={() => void refresh()}
      />

      <AlertDialog open={removeTarget != null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('repo.removeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('repo.removeConfirmDesc', { name: removeTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveConfirm()}>
              {t('repo.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
