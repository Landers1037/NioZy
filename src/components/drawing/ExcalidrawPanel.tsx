import { lazy, Suspense } from 'react'
import { DrawingPanelFallback } from './DrawingPanelFallback'

const ExcalidrawEditor = lazy(() =>
  import('./ExcalidrawEditor').then((m) => ({ default: m.ExcalidrawEditor })),
)

export function ExcalidrawPanel() {
  return (
    <Suspense fallback={<DrawingPanelFallback />}>
      <ExcalidrawEditor />
    </Suspense>
  )
}
