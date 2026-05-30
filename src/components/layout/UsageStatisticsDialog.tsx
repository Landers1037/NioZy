import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getElectronAPI } from '@/lib/electron-client'
import { formatUsageDurationMs } from '@/lib/format-usage-duration'
import type { StatisticCounters, UsageStatisticData } from '../../../electron/shared/api-types'

function StatBlock({
  title,
  counters,
  labels,
}: {
  title: string
  counters: StatisticCounters
  labels: {
    duration: string
    tabsOpened: string
    tabsClosed: string
    commands: string
  }
}) {
  const rows = [
    { label: labels.duration, value: formatUsageDurationMs(counters.usageDurationMs) },
    { label: labels.tabsOpened, value: String(counters.tabsOpened) },
    { label: labels.tabsClosed, value: String(counters.tabsClosed) },
    { label: labels.commands, value: String(counters.commandsEntered) },
  ]
  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function UsageStatisticsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [data, setData] = useState<UsageStatisticData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void getElectronAPI()
      .statistics.get()
      .then((snapshot) => {
        if (!cancelled) setData(snapshot)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const labels = {
    duration: t('settings.statistics.usageDuration'),
    tabsOpened: t('settings.statistics.tabsOpened'),
    tabsClosed: t('settings.statistics.tabsClosed'),
    commands: t('settings.statistics.commandsEntered'),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.statistics.dialogTitle')}</DialogTitle>
        </DialogHeader>
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <StatBlock title={t('settings.statistics.sinceFirstUse')} counters={data.lifetime} labels={labels} />
            <StatBlock title={t('settings.statistics.today')} counters={data.today} labels={labels} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
