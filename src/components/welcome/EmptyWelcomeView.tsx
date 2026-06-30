import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { isWebGpuEnabledInSettings, probeWebGpuRuntime } from '@/lib/webgpu-capability'
import { ASCIIText } from '@/components/effects/ASCIIText'
import type { WelcomePageAnimationMode } from '../../../electron/shared/welcome-page-settings'

const WelcomeTerminalCanvas = lazy(() =>
  import('@/components/welcome/WelcomeTerminalCanvas').then((m) => ({
    default: m.WelcomeTerminalCanvas,
  })),
)

const WelcomeLogoParticleAnimation = lazy(() =>
  import('@/components/welcome/WelcomeLogoParticleAnimation').then((m) => ({
    default: m.WelcomeLogoParticleAnimation,
  })),
)

/** 关闭欢迎页、且无 Tab 时的默认占位（原 emptyHint） */
export function EmptyWorkspaceHint() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {t('app.emptyHint')}
    </div>
  )
}

function WelcomePage3DView() {
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
    return <EmptyWorkspaceHint />
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
      <WelcomePageCaption />
    </div>
  )
}

function WelcomePageParticleView() {
  const { t } = useTranslation()
  const [sceneFailed, setSceneFailed] = useState(false)
  const handleInitFailed = useCallback(() => setSceneFailed(true), [])

  if (sceneFailed) {
    return <EmptyWorkspaceHint />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070d14]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t('common.loading')}
          </div>
        }
      >
        <div className="absolute inset-0 z-0">
          <WelcomeLogoParticleAnimation onInitFailed={handleInitFailed} />
        </div>
      </Suspense>
      <WelcomePageCaption />
    </div>
  )
}

function WelcomePageAsciiView() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050b12]">
      <div className="absolute inset-0 z-0">
        <ASCIIText
          text=">_ NioZy"
          asciiFontSize={10}
          textFontSize={240}
          planeBaseHeight={8.4}
          className="welcome-page-ascii"
        />
      </div>
      <WelcomePageCaption />
    </div>
  )
}

function WelcomePageCaption() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex flex-col items-center gap-2 px-6 text-center">
      <p className="text-base font-medium tracking-wide text-foreground/90">
        {t('app.tagline')}
      </p>
      <p className="text-sm text-muted-foreground">{t('app.emptyHint')}</p>
    </div>
  )
}

export function EmptyWelcomeView() {
  const animation: WelcomePageAnimationMode =
    useAppStore((s) => s.settings?.terminal.welcomePage.animation) ?? 'niozy3d'

  if (animation === 'ascii') {
    return <WelcomePageAsciiView />
  }

  if (animation === 'particles') {
    return <WelcomePageParticleView />
  }
  return <WelcomePage3DView />
}
