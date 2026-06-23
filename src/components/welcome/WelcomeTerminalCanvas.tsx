import { useEffect, useRef } from 'react'
import { WelcomeTerminalEngine } from '@/lib/welcome-terminal-engine'

interface WelcomeTerminalCanvasProps {
  onInitFailed: () => void
}

export function WelcomeTerminalCanvas({ onInitFailed }: WelcomeTerminalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let engine: WelcomeTerminalEngine | null = null
    let cancelled = false

    void (async () => {
      try {
        engine = new WelcomeTerminalEngine(container)
        await engine.init()
        if (cancelled) {
          engine.dispose()
          return
        }
        if (!engine.isUsingWebGpu) {
          engine.dispose()
          onInitFailed()
          return
        }
        engine.start()
      } catch {
        if (!cancelled) onInitFailed()
        engine?.dispose()
      }
    })()

    return () => {
      cancelled = true
      engine?.dispose()
    }
  }, [onInitFailed])

  return <div ref={containerRef} className="absolute inset-0 cursor-default" aria-hidden />
}
