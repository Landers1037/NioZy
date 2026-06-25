import { useCallback, useRef } from 'react'
import { animate, useMotionValue, type MotionValue } from 'motion/react'

export const STATUS_PANEL_HANDLE = 56
const SNAP_THRESHOLD = 0.38

export function useStatusPanelDrag(panelWidth: number): {
  progress: MotionValue<number>
  onHandlePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  toggle: () => void
} {
  const progress = useMotionValue(0)
  const dragStartX = useRef(0)
  const dragStartProgress = useRef(0)
  const didDrag = useRef(false)
  const panelWidthRef = useRef(panelWidth)
  panelWidthRef.current = panelWidth

  const snapTo = useCallback(
    (target: 0 | 1) => {
      void animate(progress, target, { type: 'spring', stiffness: 420, damping: 36 })
    },
    [progress],
  )

  const toggle = useCallback(() => {
    snapTo(progress.get() >= 0.5 ? 0 : 1)
  }, [progress, snapTo])

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      const handle = e.currentTarget
      const dragRange = Math.max(panelWidthRef.current, STATUS_PANEL_HANDLE)
      dragStartX.current = e.clientX
      dragStartProgress.current = progress.get()
      didDrag.current = false
      handle.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const delta = dragStartX.current - ev.clientX
        if (Math.abs(delta) > 3) didDrag.current = true
        const next = Math.min(1, Math.max(0, dragStartProgress.current + delta / dragRange))
        progress.set(next)
      }

      const finish = (ev: PointerEvent) => {
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId)
        }
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', finish)
        handle.removeEventListener('pointercancel', finish)

        if (!didDrag.current) {
          toggle()
          return
        }
        snapTo(progress.get() >= SNAP_THRESHOLD ? 1 : 0)
      }

      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', finish)
      handle.addEventListener('pointercancel', finish)
    },
    [progress, snapTo, toggle],
  )

  return { progress, onHandlePointerDown, toggle }
}
