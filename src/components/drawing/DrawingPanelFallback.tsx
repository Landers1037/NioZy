import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export function DrawingPanelFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      {t('drawing.loading')}
    </div>
  )
}
