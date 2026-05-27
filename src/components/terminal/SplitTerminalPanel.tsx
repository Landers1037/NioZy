import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { AppTab } from '@/stores/app-store'
import { TerminalView } from '@/components/terminal/TerminalView'
import { WterminalView } from '@/components/terminal/WterminalView'
import { useAppStore } from '@/stores/app-store'
import { getActiveSplitIndex, getSplitPanes } from '@/lib/terminal-tab-utils'
import { closeSplitPane, setActiveSplitPane } from '@/lib/terminal-split-actions'
import { cn } from '@/lib/utils'
import { touchTabActivity } from '@/stores/inactive-tab-activity-store'

interface SplitTerminalPanelProps {
  tab: AppTab
  isTabActive: boolean
}

export function SplitTerminalPanel({ tab, isTabActive }: SplitTerminalPanelProps) {
  const { t } = useTranslation()
  const terminalEmulator = useAppStore(
    (s) => s.settings?.experimental?.terminalEmulator ?? 'xterm',
  )
  const useWterm = terminalEmulator === 'wterm'
  const superPowerSaving = useAppStore((s) => s.settings?.performance.superPowerSaving === true)
  const TerminalComponent = useWterm ? WterminalView : TerminalView
  const panes = getSplitPanes(tab)
  const activeIndex = getActiveSplitIndex(tab)

  if (panes.length === 0) return null

  return (
    <div className="absolute inset-0 flex min-w-0">
      {panes.map((pane, index) => {
        const isPaneActive = index === activeIndex
        const showClose = panes.length > 1 && index > 0

        return (
          <div
            key={pane.terminalId}
            className={cn(
              'relative min-h-0 min-w-0 flex-1',
              index > 0 && 'border-l border-border/50',
            )}
            onPointerDown={() => {
              touchTabActivity(tab.id)
              if (!isPaneActive) setActiveSplitPane(tab.id, index)
            }}
          >
            {showClose && (
              <button
                type="button"
                className="absolute right-3 top-3 z-20 flex size-7 cursor-pointer items-center justify-center rounded-md border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('tab.closeSplitPaneAria')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => closeSplitPane(tab.id, pane.terminalId)}
              >
                <X className="size-3.5" />
              </button>
            )}
            <TerminalComponent
              tab={{ ...tab, terminalId: pane.terminalId }}
              preferDomRenderer={!useWterm && (panes.length > 1 || superPowerSaving)}
              isFocused={isTabActive && isPaneActive}
            />
          </div>
        )
      })}
    </div>
  )
}
