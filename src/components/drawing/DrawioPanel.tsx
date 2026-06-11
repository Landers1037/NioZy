import { lazy, Suspense } from 'react'
import { DrawingPanelFallback } from './DrawingPanelFallback'

const DrawioEditor = lazy(() =>
  import('./DrawioEditor').then((m) => ({ default: m.DrawioEditor })),
)

export function DrawioPanel() {
  return (
    <Suspense fallback={<DrawingPanelFallback />}>
      <DrawioEditor />
    </Suspense>
  )
}
