import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { AppTab } from '@/stores/app-store'
import { TerminalView } from '@/components/terminal/TerminalView'
import { getActiveSplitIndex, getSplitPanes } from '@/lib/terminal-tab-utils'
import { closeSplitPane, setActiveSplitPane } from '@/lib/terminal-split-actions'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'

interface SplitTerminalPanelProps {
  tab: AppTab
}

export function SplitTerminalPanel({ tab }: SplitTerminalPanelProps) {
  const { t } = useTranslation()
  const panes = getSplitPanes(tab)
  const activeIndex = getActiveSplitIndex(tab)

  const paneIds = panes.map((p) => p.terminalId).join(',')

  useEffect(() => {
    const ids = panes.map((p) => p.terminalId)
    if (ids.length === 0) return
    const api = getElectronAPI()
    if (ids.length > 1) {
      void api.terminal.setActiveStreams(ids)
    } else {
      void api.terminal.setActiveStream(ids[0]!)
    }
    return () => {
      void api.terminal.setActiveStream(null)
    }
  }, [paneIds])

  if (panes.length === 0) return null

  return (
    <div className="absolute inset-0 flex min-w-0">
      {panes.map((pane, index) => {
        const isActive = index === activeIndex
        const showClose = panes.length > 1 && index > 0

        return (
          <div
            key={pane.terminalId}
            className={cn(
              'relative min-h-0 min-w-0 flex-1',
              index > 0 && 'border-l border-border/50',
            )}
            onPointerDown={() => {
              if (!isActive) setActiveSplitPane(tab.id, index)
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
            <TerminalView
              tab={{ ...tab, terminalId: pane.terminalId }}
              preferDomRenderer={panes.length > 1}
            />
          </div>
        )
      })}
    </div>
  )
}
