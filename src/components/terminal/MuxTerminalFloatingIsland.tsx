import { useState } from 'react'
import { Infinity, Maximize2, PanelRightClose } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { MuxLayoutKind } from '../../../electron/shared/mux-terminal-types'
import { activePaneCountFromLayoutKind } from '../../../electron/shared/mux-terminal-types'

interface MuxTerminalFloatingIslandProps {
  layoutKind: MuxLayoutKind
  resizeMode: boolean
  onEnterResizeMode: () => void
  onClosePane: () => void
}

export function MuxTerminalFloatingIsland({
  layoutKind,
  resizeMode,
  onEnterResizeMode,
  onClosePane,
}: MuxTerminalFloatingIslandProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const canManagePanes = activePaneCountFromLayoutKind(layoutKind) > 1

  if (!canManagePanes) return null

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-30 flex justify-end">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 text-muted-foreground shadow-md backdrop-blur-md transition-all',
            'hover:bg-muted/90 hover:text-foreground',
            open && 'rounded-2xl bg-background/95 px-3 py-2 shadow-lg',
            resizeMode && 'border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400',
          )}
          aria-label={t('muxTerminal.floatingIslandAria')}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Infinity className="size-4 shrink-0" />
          {open && (
            <span className="text-xs font-medium">{t('muxTerminal.floatingIslandTitle')}</span>
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-[calc(100%+8px)] min-w-[168px] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-1 shadow-xl backdrop-blur-md"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                resizeMode && 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
              )}
              onClick={() => {
                onEnterResizeMode()
                setOpen(false)
              }}
            >
              <Maximize2 className="size-4 shrink-0 opacity-70" />
              {t('muxTerminal.resizePane')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                onClosePane()
                setOpen(false)
              }}
            >
              <PanelRightClose className="size-4 shrink-0 opacity-70" />
              {t('muxTerminal.closePane')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
