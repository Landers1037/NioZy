import { useCallback, useRef, useState } from 'react'
import { setLayoutResizing } from '@/lib/layout-resize'

interface UsePaneResizeOptions {
  width: number
  minWidth: number
  maxWidth: number
  onCommit: (width: number) => void
}

function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function usePaneResize({ width, minWidth, maxWidth, onCommit }: UsePaneResizeOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const handle = e.currentTarget
      const container = containerRef.current
      if (!container) return

      handle.setPointerCapture(e.pointerId)

      const startX = e.clientX
      const startWidth = width

      setIsResizing(true)
      setLayoutResizing(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: PointerEvent) => {
        const next = clampWidth(startWidth + ev.clientX - startX, minWidth, maxWidth)
        container.style.width = `${next}px`
      }

      const finish = (ev: PointerEvent) => {
        const next = clampWidth(startWidth + ev.clientX - startX, minWidth, maxWidth)
        container.style.width = ''
        setIsResizing(false)
        setLayoutResizing(false)
        onCommit(next)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId)
        }
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', finish)
        handle.removeEventListener('pointercancel', finish)
      }

      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', finish)
      handle.addEventListener('pointercancel', finish)
    },
    [width, minWidth, maxWidth, onCommit],
  )

  return { containerRef, width, isResizing, startResize }
}
