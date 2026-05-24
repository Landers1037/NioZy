import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/app-store'

const LONG_PRESS_MS = 1000
const MOVE_CANCEL_PX = 6

interface UseSidebarTabDragOptions {
  enabled: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useSidebarTabDrag({ enabled, containerRef }: UseSidebarTabDragOptions) {
  const reorderTab = useAppStore((s) => s.reorderTab)

  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const longPressTimerRef = useRef<number | null>(null)
  const pendingTabIdRef = useRef<string | null>(null)
  const startPointerRef = useRef({ x: 0, y: 0 })
  const suppressClickRef = useRef(false)

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    pendingTabIdRef.current = null
  }, [])

  const computeDropIndex = useCallback(
    (clientY: number) => {
      const container = containerRef.current
      if (!container) return 0
      const items = Array.from(
        container.querySelectorAll<HTMLElement>('[data-sidebar-tab-id]'),
      )
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        if (clientY < mid) return i
      }
      return items.length
    },
    [containerRef],
  )

  const finishDrag = useCallback(
    (tabId: string, clientY: number) => {
      const nextIndex = computeDropIndex(clientY)
      reorderTab(tabId, nextIndex)
      setDraggingTabId(null)
      setDropIndex(null)
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    },
    [computeDropIndex, reorderTab],
  )

  const onTabPointerDown = useCallback(
    (tabId: string, e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      clearLongPressTimer()
      pendingTabIdRef.current = tabId
      startPointerRef.current = { x: e.clientX, y: e.clientY }
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        setDraggingTabId(tabId)
        setDropIndex(computeDropIndex(e.clientY))
      }, LONG_PRESS_MS)
    },
    [clearLongPressTimer, computeDropIndex, enabled],
  )

  const onTabPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (longPressTimerRef.current != null && pendingTabIdRef.current) {
        const dx = e.clientX - startPointerRef.current.x
        const dy = e.clientY - startPointerRef.current.y
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearLongPressTimer()
        }
        return
      }
      if (draggingTabId) {
        e.preventDefault()
        setDropIndex(computeDropIndex(e.clientY))
      }
    },
    [clearLongPressTimer, computeDropIndex, draggingTabId],
  )

  const onTabPointerUp = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const onTabPointerCancel = useCallback(() => {
    clearLongPressTimer()
    setDraggingTabId(null)
    setDropIndex(null)
  }, [clearLongPressTimer])

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, [])

  useEffect(() => {
    if (!draggingTabId) return

    const handleMove = (e: PointerEvent) => {
      setDropIndex(computeDropIndex(e.clientY))
    }
    const handleUp = (e: PointerEvent) => {
      finishDrag(draggingTabId, e.clientY)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [computeDropIndex, draggingTabId, finishDrag])

  useEffect(() => {
    if (!enabled) {
      clearLongPressTimer()
      setDraggingTabId(null)
      setDropIndex(null)
    }
  }, [clearLongPressTimer, enabled])

  return {
    draggingTabId,
    dropIndex,
    onTabPointerDown,
    onTabPointerMove,
    onTabPointerUp,
    onTabPointerCancel,
    shouldSuppressClick,
  }
}
