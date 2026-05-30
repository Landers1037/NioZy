import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
} from '@/lib/pomodoro-timer-types'
import {
  formatPomodoroDurationMinutes,
  formatPomodoroRemaining,
  usePomodoroStore,
} from '@/stores/pomodoro-store'
import { cn } from '@/lib/utils'

const RING_SIZE = 200
const STROKE = 11
const RADIUS = (RING_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function PomodoroRing({
  remainingMs,
  totalMs,
  running,
}: {
  remainingMs: number
  totalMs: number
  running: boolean
}) {
  const progress = totalMs > 0 ? remainingMs / totalMs : 0
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="relative mx-auto flex size-[200px] items-center justify-center">
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-muted/40"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className={cn(
            'text-primary transition-[stroke-dashoffset] duration-300 ease-linear',
            running && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.35)]',
          )}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1">
        <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatPomodoroRemaining(remainingMs)}
        </span>
      </div>
    </div>
  )
}

export function PomodoroDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const init = usePomodoroStore((s) => s.init)
  const status = usePomodoroStore((s) => s.status)
  const durationMinutes = usePomodoroStore((s) => s.durationMinutes)
  const totalMs = usePomodoroStore((s) => s.totalMs)
  const remainingMs = usePomodoroStore((s) => s.remainingMs)
  const setDurationMinutes = usePomodoroStore((s) => s.setDurationMinutes)
  const start = usePomodoroStore((s) => s.start)
  const pause = usePomodoroStore((s) => s.pause)
  const reset = usePomodoroStore((s) => s.reset)

  useEffect(() => {
    init()
  }, [init])

  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isActive = isRunning || isPaused
  const canAdjustDuration = !isActive

  const handlePrimaryAction = () => {
    if (isRunning) {
      pause()
      return
    }
    start()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('pomodoro.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          <PomodoroRing remainingMs={remainingMs} totalMs={totalMs} running={isRunning} />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="pomodoro-duration" className="text-sm text-muted-foreground">
                {t('pomodoro.duration')}
              </Label>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatPomodoroDurationMinutes(durationMinutes, t)}
              </span>
            </div>
            <Slider
              id="pomodoro-duration"
              min={POMODORO_MIN_MINUTES}
              max={POMODORO_MAX_MINUTES}
              step={5}
              value={[durationMinutes]}
              disabled={!canAdjustDuration}
              onValueChange={(value) => {
                const next = value[0]
                if (next !== undefined) setDurationMinutes(next)
              }}
              aria-label={t('pomodoro.duration')}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{formatPomodoroDurationMinutes(POMODORO_MIN_MINUTES, t)}</span>
              <span>{formatPomodoroDurationMinutes(POMODORO_MAX_MINUTES, t)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="default"
              className="min-w-28"
              onClick={handlePrimaryAction}
            >
              {isRunning ? (
                <>
                  <Pause className="size-4" aria-hidden />
                  {t('pomodoro.pause')}
                </>
              ) : (
                <>
                  <Play className="size-4" aria-hidden />
                  {isPaused ? t('pomodoro.resume') : t('pomodoro.start')}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!isActive && remainingMs === totalMs}
              onClick={() => reset()}
            >
              <RotateCcw className="size-4" aria-hidden />
              {t('pomodoro.reset')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
