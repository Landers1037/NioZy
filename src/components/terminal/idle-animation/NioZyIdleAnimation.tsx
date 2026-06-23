import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { isWebGpuEnabledInSettings, probeWebGpuRuntime } from '@/lib/webgpu-capability'
import { LogoIdleAnimation } from '@/components/terminal/idle-animation/LogoIdleAnimation'

interface NioZyIdleAnimationProps {
  width: number
  height: number
}

export function NioZyIdleAnimation({ width, height }: NioZyIdleAnimationProps) {
  const settings = useAppStore((s) => s.settings)
  const containerRef = useRef<HTMLDivElement>(null)
  const webGpuSettingEnabled = isWebGpuEnabledInSettings(settings)
  const [runtimeReady, setRuntimeReady] = useState<'pending' | 'yes' | 'no'>(
    webGpuSettingEnabled ? 'pending' : 'no',
  )

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

  useEffect(() => {
    if (!webGpuSettingEnabled || runtimeReady !== 'yes') return
    const container = containerRef.current
    if (!container) return

    let engine: import('@/lib/welcome-terminal-engine').WelcomeTerminalEngine | null = null
    let cancelled = false

    void (async () => {
      const { WelcomeTerminalEngine } = await import('@/lib/welcome-terminal-engine')
      try {
        engine = new WelcomeTerminalEngine(container, { compact: true })
        await engine.init()
        if (cancelled) {
          engine.dispose()
          return
        }
        if (!engine.isUsingWebGpu) {
          engine.dispose()
          setRuntimeReady('no')
          return
        }
        engine.start()
      } catch {
        if (!cancelled) setRuntimeReady('no')
        engine?.dispose()
      }
    })()

    return () => {
      cancelled = true
      engine?.dispose()
    }
  }, [webGpuSettingEnabled, runtimeReady, width, height])

  if (!webGpuSettingEnabled || runtimeReady === 'no') {
    return <LogoIdleAnimation width={width} height={height} />
  }

  if (runtimeReady === 'pending') {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ width, height }}
      aria-hidden
    />
  )
}
