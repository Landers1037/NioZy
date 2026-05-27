import { useTranslation } from 'react-i18next'
import { BatteryCharging, Loader2 } from 'lucide-react'

interface SuperPowerSavingPlaceholderProps {
  tabId: string
  resuming?: boolean
}

export function SuperPowerSavingPlaceholder({
  tabId,
  resuming = false,
}: SuperPowerSavingPlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
      data-tab-id={tabId}
    >
      {resuming ? (
        <Loader2 className="size-8 animate-spin opacity-60" strokeWidth={1.5} />
      ) : (
        <BatteryCharging className="size-8 opacity-40" strokeWidth={1.5} />
      )}
      <p className="text-sm">
        {resuming
          ? t('terminal.superPowerSavingResuming')
          : t('terminal.superPowerSavingIdle')}
      </p>
    </div>
  )
}
