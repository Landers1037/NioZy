import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface RepoPullOverlayProps {
  repoName: string
}

/** 仓库 git pull 时的全屏前台加载遮罩 */
export function RepoPullOverlay({ repoName }: RepoPullOverlayProps) {
  const { t } = useTranslation()

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card px-8 py-6 shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-center text-sm font-medium">{t('repo.pulling', { name: repoName })}</p>
        <p className="text-center text-xs text-muted-foreground">{t('repo.pullingHint')}</p>
      </div>
    </div>
  )
}
