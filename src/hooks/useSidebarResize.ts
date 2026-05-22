import { useCallback, useState } from 'react'
import {
  clampSidebarWidth,
  SIDEBAR_COLLAPSED_WIDTH,
} from '../../electron/shared/sidebar-width'

interface UseSidebarResizeOptions {
  width: number
  collapsed: boolean
  onCommit: (width: number) => void
}

export function useSidebarResize({ width, collapsed, onCommit }: UseSidebarResizeOptions) {
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const isResizing = dragWidth !== null

  const displayWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : (dragWidth ?? width)

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return
      e.preventDefault()
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)

      const startX = e.clientX
      const startWidth = width

      const onMove = (ev: PointerEvent) => {
        setDragWidth(clampSidebarWidth(startWidth + ev.clientX - startX))
      }

      const onUp = (ev: PointerEvent) => {
        const next = clampSidebarWidth(startWidth + ev.clientX - startX)
        setDragWidth(null)
        onCommit(next)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId)
        }
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    },
    [collapsed, width, onCommit],
  )

  return { displayWidth, isResizing, startResize }
}
