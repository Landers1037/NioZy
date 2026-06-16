import { useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { TerminalIdleAnimationMode } from '../../../electron/shared/terminal-idle-animation'
import { BlackHoleRenderer } from '@/lib/terminal-idle-animation/black-hole-renderer'
import { BlackHole2Renderer } from '@/lib/terminal-idle-animation/black-hole2-renderer'
import { devError } from '../../../electron/shared/dev-log'
import { LogoIdleAnimation } from '@/components/terminal/idle-animation/LogoIdleAnimation'
import { PacmanIdleAnimation } from '@/components/terminal/idle-animation/PacmanIdleAnimation'

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

function IdleAnimationLayer({
  box,
  children,
}: {
  box: ScreenBox
  children: React.ReactNode
}) {
  return (
    <div
      className="pointer-events-none absolute z-[999] overflow-hidden"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
      aria-hidden
    >
      {children}
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
  const rendererRef = useRef<BlackHoleRenderer | BlackHole2Renderer | null>(null)
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
    const isBlackHoleMode = mode === 'blackHole' || mode === 'blackHole2'
    if (!isBlackHoleMode || !enabled || !screenBox) return

    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: BlackHoleRenderer | BlackHole2Renderer
    try {
      renderer =
        mode === 'blackHole2' ? new BlackHole2Renderer(canvas) : new BlackHoleRenderer(canvas)
      rendererRef.current = renderer
    } catch (error) {
      devError('[TerminalIdleAnimation] renderer init failed:', error)
      return
    }

    const tick = () => {
      const frame = renderer.getFrame(screenBox.width, screenBox.height)
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

  if (mode === 'pacman') {
    return (
      <IdleAnimationLayer box={screenBox}>
        <PacmanIdleAnimation width={screenBox.width} height={screenBox.height} />
      </IdleAnimationLayer>
    )
  }

  if (mode === 'logo') {
    return (
      <IdleAnimationLayer box={screenBox}>
        <LogoIdleAnimation width={screenBox.width} height={screenBox.height} />
      </IdleAnimationLayer>
    )
  }

  return (
    <IdleAnimationLayer box={screenBox}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ background: 'transparent' }}
      />
    </IdleAnimationLayer>
  )
}
