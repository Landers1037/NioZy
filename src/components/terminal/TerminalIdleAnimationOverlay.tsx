import { useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { TerminalIdleAnimationMode } from '../../../electron/shared/terminal-idle-animation'
import {
  BLACK_HOLE_CANVAS_SIZE_PX,
  BlackHoleRenderer,
} from '@/lib/terminal-idle-animation/black-hole-renderer'

interface TerminalIdleAnimationOverlayProps {
  term: Terminal
  mode: TerminalIdleAnimationMode
  enabled: boolean
  hostRef: React.RefObject<HTMLElement | null>
}

type ScreenBox = {
  left: number
  top: number
  width: number
  height: number
}

function PacmanPlaceholder({ box }: { box: ScreenBox }) {
  return (
    <div
      className="pointer-events-none absolute z-[999] flex items-center justify-center"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <div className="rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 px-4 py-2 text-sm text-yellow-200/80">
        Pac-Man
      </div>
    </div>
  )
}

function TypeWriterPlaceholder({ box }: { box: ScreenBox }) {
  return (
    <div
      className="pointer-events-none absolute z-[999] flex items-center justify-center"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-2 font-mono text-sm text-muted-foreground">
        TypeWriter...
      </div>
    </div>
  )
}

function measureScreenBox(term: Terminal, host: HTMLElement): ScreenBox | null {
  const screen = term.element?.querySelector('.xterm-screen') as HTMLElement | null
  const target = screen ?? (term.element as HTMLElement | null)
  if (!target) return null

  const hostRect = host.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  if (targetRect.width <= 0 || targetRect.height <= 0) return null

  return {
    left: targetRect.left - hostRect.left,
    top: targetRect.top - hostRect.top,
    width: targetRect.width,
    height: targetRect.height,
  }
}

export function TerminalIdleAnimationOverlay({
  term,
  mode,
  enabled,
  hostRef,
}: TerminalIdleAnimationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BlackHoleRenderer | null>(null)
  const rafRef = useRef<number | null>(null)
  const [screenBox, setScreenBox] = useState<ScreenBox | null>(null)

  useEffect(() => {
    if (!enabled) {
      setScreenBox(null)
      return
    }

    const host = hostRef.current
    if (!host) return

    const updateBox = () => {
      const next = measureScreenBox(term, host)
      setScreenBox((prev) => {
        if (!prev || !next) return next
        const same =
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        return same ? prev : next
      })
    }

    updateBox()
    const screen = term.element?.querySelector('.xterm-screen')
    const ro = new ResizeObserver(updateBox)
    ro.observe(host)
    if (screen) ro.observe(screen)
    window.addEventListener('resize', updateBox)

    const poll = window.setInterval(updateBox, 500)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateBox)
      window.clearInterval(poll)
    }
  }, [term, enabled, hostRef])

  useEffect(() => {
    if (mode !== 'blackHole' || !enabled || !screenBox) return

    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: BlackHoleRenderer
    try {
      renderer = new BlackHoleRenderer(canvas)
      rendererRef.current = renderer
    } catch {
      return
    }

    const tick = () => {
      const frame = renderer.getFrame(screenBox.width, screenBox.height)
      canvas.style.left = `${screenBox.left + frame.left}px`
      canvas.style.top = `${screenBox.top + frame.top}px`
      canvas.style.width = `${frame.size}px`
      canvas.style.height = `${frame.size}px`
      renderer.render(term, frame, { width: screenBox.width, height: screenBox.height })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      renderer.dispose()
      rendererRef.current = null
    }
  }, [term, mode, enabled, screenBox])

  if (!enabled || !screenBox) return null

  if (mode === 'pacman') return <PacmanPlaceholder box={screenBox} />
  if (mode === 'typeWriter') return <TypeWriterPlaceholder box={screenBox} />

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute z-[999]"
      style={{
        left: screenBox.left,
        top: screenBox.top,
        width: BLACK_HOLE_CANVAS_SIZE_PX,
        height: BLACK_HOLE_CANVAS_SIZE_PX,
      }}
      aria-hidden
    />
  )
}
