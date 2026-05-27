import { lazy, Suspense, useMemo } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { resolveInactiveTabPolicy } from '@/lib/inactive-tab-memory'
import { useInactiveTabOptimizationTick } from '@/hooks/useInactiveTabOptimizationTick'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { InactiveTerminalPlaceholder } from '@/components/terminal/InactiveTerminalPlaceholder'
import { cn } from '@/lib/utils'

const SplitTerminalPanel = lazy(() =>
  import('@/components/terminal/SplitTerminalPanel').then((m) => ({
    default: m.SplitTerminalPanel,
  })),
)

interface TerminalTabLayerProps {
  tab: AppTab
  isTabActive: boolean
}

export function TerminalTabLayer({ tab, isTabActive }: TerminalTabLayerProps) {
  const performance = useAppStore((s) => s.settings?.performance)
  const lastActivityAt = useInactiveTabActivityStore((s) => s.tabLastActivityAt[tab.id])
  const optimizationTick = useInactiveTabOptimizationTick()
  const policy = useMemo(
    () =>
      resolveInactiveTabPolicy(performance, isTabActive, lastActivityAt, Date.now()),
    [performance, isTabActive, lastActivityAt, optimizationTick],
  )

  return (
    <div
      className={cn(
        'absolute inset-0',
        !isTabActive && 'pointer-events-none invisible',
        policy.sleepStyle && 'niozy-terminal-tab-sleep',
      )}
      {...(!isTabActive ? { inert: true } : {})}
    >
      {policy.mountTerminal ? (
        <Suspense fallback={null}>
          <SplitTerminalPanel tab={tab} isTabActive={isTabActive} />
        </Suspense>
      ) : (
        <InactiveTerminalPlaceholder tabId={tab.id} />
      )}
    </div>
  )
}
