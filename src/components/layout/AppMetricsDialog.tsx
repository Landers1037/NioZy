import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getElectronAPI } from '@/lib/electron-client'
import type { AppMetricsData } from '../../../electron/shared/api-types'
interface AppMetricsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatFetchedAt(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour12: false })
  } catch {
    return iso
  }
}

function processTypeKey(type: string): string {
  return `appMetrics.processType.${type.replace(/\s+/g, '_')}`
}

export function AppMetricsDialog({ open, onOpenChange }: AppMetricsDialogProps) {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<AppMetricsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const metrics = await getElectronAPI().system.getAppMetrics()
      setData(metrics)
    } catch {
      setError(t('appMetrics.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) return
    void load()
    const id = setInterval(() => void load(), 2000)
    return () => clearInterval(id)
  }, [open, load])

  const processTypeLabel = (type: string) => {
    const key = processTypeKey(type)
    const translated = t(key)
    return translated === key ? type : translated
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('appMetrics.title')}</DialogTitle>
          <DialogDescription>{t('appMetrics.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {data
              ? t('appMetrics.fetchedAt', {
                  time: formatFetchedAt(data.fetchedAt, i18n.language),
                })
              : t('appMetrics.fetchedAtUnknown')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {t('appMetrics.refresh')}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : data ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
              <MetricSummary label={t('appMetrics.totalWorkingSet')} value={`${data.totalWorkingSetMb} MB`} />
              <MetricSummary label={t('appMetrics.totalPeak')} value={`${data.totalPeakWorkingSetMb} MB`} />
              <MetricSummary label={t('appMetrics.mainRss')} value={`${data.mainRssMb} MB`} />
              <MetricSummary
                label={t('appMetrics.mainHeap')}
                value={`${data.mainHeapUsedMb} / ${data.mainHeapTotalMb} MB`}
              />
              <MetricSummary
                label={t('appMetrics.processCount')}
                value={String(data.processes.length)}
              />
            </dl>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[480px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t('appMetrics.colType')}</th>
                    <th className="px-3 py-2 font-medium">{t('appMetrics.colPid')}</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('appMetrics.colWorkingSet')}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">{t('appMetrics.colPeak')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('appMetrics.colCpu')}</th>
                    <th className="px-3 py-2 font-medium">{t('appMetrics.colSandbox')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.processes.map((p) => (
                    <tr key={p.pid} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">{processTypeLabel(p.type)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{p.pid}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {p.workingSetMb} MB
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {p.peakWorkingSetMb} MB
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {p.cpuPercent}%
                      </td>
                      <td className="px-3 py-2">
                        {p.sandboxed ? t('appMetrics.sandboxed') : t('appMetrics.notSandboxed')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('appMetrics.loading')}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MetricSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
    </div>
  )
}
