import { toast } from 'sonner'
import i18n from '@/lib/i18n'

function formatAchievedDuration(totalMs: number): string {
  const minutes = Math.max(1, Math.round(totalMs / 60_000))
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (m === 0) return i18n.t('pomodoro.durationHours', { h })
    return i18n.t('pomodoro.durationHoursMinutes', { h, m })
  }
  return i18n.t('pomodoro.durationMinutes', { m: minutes })
}

export function showPomodoroCompleteToast(totalMs: number) {
  const durationLabel = formatAchievedDuration(totalMs)

  toast.custom(
    () => (
      <div className="relative w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-emerald-500/25 bg-card shadow-lg ring-1 ring-emerald-500/10">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600" />
        <div className="flex items-start gap-3 p-4 pl-5">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200/80 text-2xl shadow-inner dark:from-amber-500/20 dark:to-amber-600/10"
            aria-hidden
          >
            🏅
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {i18n.t('toast.pomodoroComplete')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {i18n.t('toast.pomodoroCompleteSubtitle')}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {i18n.t('toast.pomodoroCompleteDurationLabel')}
              </span>
              <span className="text-sm font-semibold tabular-nums text-primary">{durationLabel}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { duration: 8000, unstyled: true },
  )
}
