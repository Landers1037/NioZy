import { useTranslation } from 'react-i18next'
import { GitBranch, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ManagedRepoSummary } from '../../../electron/shared/repo-types'
import { cn } from '@/lib/utils'

interface RepoCardProps {
  repo: ManagedRepoSummary
  busy: boolean
  onOpen: () => void
  onPull: () => void
  onSwitchBranch: () => void
  onRemove: () => void
}

export function RepoCard({
  repo,
  busy,
  onOpen,
  onPull,
  onSwitchBranch,
  onRemove,
}: RepoCardProps) {
  const { t } = useTranslation()

  const lastCommitLabel = repo.lastCommitAt
    ? new Date(repo.lastCommitAt).toLocaleString()
    : t('repo.noCommits')

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-primary/40',
        repo.error && 'border-destructive/40',
      )}
      onClick={onOpen}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{repo.name}</CardTitle>
        <p className="truncate font-mono text-xs text-muted-foreground">{repo.path}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="size-3.5 shrink-0" />
            <span>{repo.branch ?? t('repo.unknownBranch')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{lastCommitLabel}</span>
          </div>
          {repo.lastCommitMessage ? (
            <p className="truncate text-xs text-muted-foreground">{repo.lastCommitMessage}</p>
          ) : null}
          {repo.error ? (
            <p className="text-xs text-destructive">{t(`repo.errors.${repo.error}`, repo.error)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onOpen}>
            {t('repo.view')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !!repo.error} onClick={onPull}>
            {t('repo.pull')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !!repo.error}
            onClick={onSwitchBranch}
          >
            {t('repo.switchBranch')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
            {t('repo.remove')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
