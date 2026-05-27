import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface AttachPtyPendingPlaceholderProps {
  tabId: string
}

export function AttachPtyPendingPlaceholder({ tabId }: AttachPtyPendingPlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
      data-tab-id={tabId}
    >
      <Loader2 className="size-7 animate-spin opacity-50" strokeWidth={1.5} />
      <p className="text-sm">{t('terminal.attachPtyPending')}</p>
    </div>
  )
}
