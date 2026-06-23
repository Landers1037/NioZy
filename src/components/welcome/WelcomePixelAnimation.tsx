import { useEffect, useRef } from 'react'

interface WelcomePixelAnimationProps {
  onInitFailed?: () => void
}

export function WelcomePixelAnimation({ onInitFailed }: WelcomePixelAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let engine: import('@/lib/welcome-pixel-animation-engine').WelcomePixelAnimationEngine | null =
      null
    let cancelled = false

    void (async () => {
      try {
        const { WelcomePixelAnimationEngine } = await import('@/lib/welcome-pixel-animation-engine')
        engine = new WelcomePixelAnimationEngine(container)
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
      className="absolute inset-0 flex items-start justify-center pt-[8vh]"
      aria-hidden
    />
  )
}
