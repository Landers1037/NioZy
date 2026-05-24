import { useCallback, useRef, useState } from 'react'
import {
  clampSidebarWidth,
  SIDEBAR_COLLAPSED_WIDTH,
} from '../../electron/shared/sidebar-width'
import { setLayoutResizing } from '@/lib/layout-resize'

interface UseSidebarResizeOptions {
  width: number
  collapsed: boolean
  onCommit: (width: number) => void
}

export function useSidebarResize({ width, collapsed, onCommit }: UseSidebarResizeOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const displayWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return
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
        const next = clampSidebarWidth(startWidth + ev.clientX - startX)
        container.style.width = `${next}px`
      }

      const finish = (ev: PointerEvent) => {
        const next = clampSidebarWidth(startWidth + ev.clientX - startX)
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
    [collapsed, width, onCommit],
  )

  return { containerRef, displayWidth, isResizing, startResize }
}
