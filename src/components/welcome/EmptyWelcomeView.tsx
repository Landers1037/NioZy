import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { isWebGpuEnabledInSettings, probeWebGpuRuntime } from '@/lib/webgpu-capability'

const WelcomeTerminalCanvas = lazy(() =>
  import('@/components/welcome/WelcomeTerminalCanvas').then((m) => ({
    default: m.WelcomeTerminalCanvas,
  })),
)

function DefaultEmptyHint() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {t('app.emptyHint')}
    </div>
  )
}

export function EmptyWelcomeView() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const webGpuSettingEnabled = isWebGpuEnabledInSettings(settings)
  const [runtimeReady, setRuntimeReady] = useState<'pending' | 'yes' | 'no'>(
    webGpuSettingEnabled ? 'pending' : 'no',
  )
  const [sceneFailed, setSceneFailed] = useState(false)

  useEffect(() => {
    if (!webGpuSettingEnabled) {
      setRuntimeReady('no')
      return
    }
    let cancelled = false
    void probeWebGpuRuntime().then((ok) => {
      if (!cancelled) setRuntimeReady(ok ? 'yes' : 'no')
    })
    return () => {
      cancelled = true
    }
  }, [webGpuSettingEnabled])

  const handleInitFailed = useCallback(() => setSceneFailed(true), [])

  if (!webGpuSettingEnabled || runtimeReady === 'no' || sceneFailed) {
    return <DefaultEmptyHint />
  }

  if (runtimeReady === 'pending') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t('common.loading')}
          </div>
        }
      >
        <WelcomeTerminalCanvas onInitFailed={handleInitFailed} />
      </Suspense>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex flex-col items-center gap-2 px-6 text-center">
        <p className="text-base font-medium tracking-wide text-foreground/90">
          {t('app.tagline')}
        </p>
        <p className="text-sm text-muted-foreground">{t('app.emptyHint')}</p>
      </div>
    </div>
  )
}
