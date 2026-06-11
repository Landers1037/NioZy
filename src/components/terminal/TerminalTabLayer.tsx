import { lazy, memo, Suspense, useMemo } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { resolveInactiveTabPolicy } from '@/lib/inactive-tab-memory'
import { isAttachPtyRenderMode } from '@/lib/attach-pty-render'
import { getSplitPanes } from '@/lib/terminal-tab-utils'
import { useInactiveTabOptimizationTick } from '@/hooks/useInactiveTabOptimizationTick'
import { useInactiveTabActivityStore } from '@/stores/inactive-tab-activity-store'
import { useSuperPowerSavingStore } from '@/stores/super-power-saving-store'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'
import { InactiveTerminalPlaceholder } from '@/components/terminal/InactiveTerminalPlaceholder'
import { SuperPowerSavingPlaceholder } from '@/components/terminal/SuperPowerSavingPlaceholder'
import { AttachPtyPendingPlaceholder } from '@/components/terminal/AttachPtyPendingPlaceholder'
import { TerminalBackgroundLayer } from '@/components/terminal/TerminalBackgroundLayer'
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

function terminalTabLayerPropsEqual(
  prev: TerminalTabLayerProps,
  next: TerminalTabLayerProps,
): boolean {
  return prev.isTabActive === next.isTabActive && prev.tab === next.tab
}

export const TerminalTabLayer = memo(function TerminalTabLayer({
  tab,
  isTabActive,
}: TerminalTabLayerProps) {
  const performance = useAppStore((s) => s.settings?.performance)
  const terminalSettings = useAppStore((s) => s.settings?.terminal)
  const attachPtyRenderMode = useAppStore((s) => isAttachPtyRenderMode(s.settings))
  const useAttachLayer = attachPtyRenderMode && getSplitPanes(tab).length <= 1
  const pendingTabId = useAttachPtySessionStore((s) => s.pendingTabId)
  const committed = useAttachPtySessionStore((s) => s.committed)
  const ptySuspended = useSuperPowerSavingStore((s) => !!s.suspendedTabIds[tab.id])
  const ptyResuming = useSuperPowerSavingStore((s) => !!s.resumingTabIds[tab.id])
  const lastActivityAt = useInactiveTabActivityStore((s) => s.tabLastActivityAt[tab.id])
  const optimizationTick = useInactiveTabOptimizationTick()
  const policy = useMemo(
    () =>
      resolveInactiveTabPolicy(performance, isTabActive, lastActivityAt, Date.now()),
    [performance, isTabActive, lastActivityAt, optimizationTick],
  )

  const superPowerSaving = performance?.superPowerSaving === true
  const waitForPtyResume = superPowerSaving && isTabActive && (ptySuspended || ptyResuming)
  const mountTerminal = policy.mountTerminal && !waitForPtyResume
  const attachCommittedHere =
    useAttachLayer && isTabActive && committed?.tabId === tab.id && pendingTabId !== tab.id
  const attachPendingHere = useAttachLayer && isTabActive && pendingTabId === tab.id

  const terminalBody = (() => {
    if (!mountTerminal) {
      if (waitForPtyResume) {
        return <SuperPowerSavingPlaceholder tabId={tab.id} resuming />
      }
      if (superPowerSaving) {
        return <SuperPowerSavingPlaceholder tabId={tab.id} />
      }
      return <InactiveTerminalPlaceholder tabId={tab.id} />
    }

    if (useAttachLayer) {
      if (attachPendingHere) {
        return <AttachPtyPendingPlaceholder tabId={tab.id} />
      }
      if (attachCommittedHere) {
        return <div className="absolute inset-0" aria-hidden />
      }
      if (isTabActive) {
        return <AttachPtyPendingPlaceholder tabId={tab.id} />
      }
      return null
    }

    return (
      <Suspense fallback={null}>
        <SplitTerminalPanel tab={tab} isTabActive={isTabActive} />
      </Suspense>
    )
  })()

  return (
    <div
      className={cn(
        'absolute inset-0',
        !isTabActive && 'pointer-events-none invisible',
        policy.sleepStyle && 'niozy-terminal-tab-sleep',
      )}
      {...(!isTabActive ? { inert: true } : {})}
    >
      <TerminalBackgroundLayer
        terminal={terminalSettings}
        className="pointer-events-none absolute inset-0 z-0"
      />
      <div className="relative z-10 h-full w-full">{terminalBody}</div>
    </div>
  )
}, terminalTabLayerPropsEqual)
