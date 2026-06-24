import { useEffect, useRef } from 'react'

interface WelcomeLogoParticleAnimationProps {
  onInitFailed?: () => void
}

export function WelcomeLogoParticleAnimation({ onInitFailed }: WelcomeLogoParticleAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let engine: import('@/lib/welcome-logo-particle-engine').WelcomeLogoParticleEngine | null =
      null
    let cancelled = false

    void (async () => {
      try {
        const { WelcomeLogoParticleEngine } = await import('@/lib/welcome-logo-particle-engine')
        engine = new WelcomeLogoParticleEngine(container)
        await engine.init()
        if (cancelled) {
          engine.dispose()
          return
        }
        engine.start()
      } catch {
        if (!cancelled) onInitFailed?.()
        engine?.dispose()
      }
    })()

    return () => {
      cancelled = true
      engine?.dispose()
    }
  }, [onInitFailed])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
    />
  )
}
