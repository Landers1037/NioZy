import { useTranslation } from 'react-i18next'
import { SquareTerminal } from 'lucide-react'
import { UI_DIALOG_OVERLAY } from '@/lib/dialog-animations'

interface RestoreTerminalSessionOverlayProps {
  visible: boolean
}

export function RestoreTerminalSessionOverlay({ visible }: RestoreTerminalSessionOverlayProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div
      className={`${UI_DIALOG_OVERLAY} fixed inset-0 z-[300] flex items-center justify-center bg-background/75 backdrop-blur-sm`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ui-overlay-panel flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-10 py-8 shadow-lg">
        <div className="restore-session-wheel-stage flex size-16 items-center justify-center">
          <SquareTerminal
            className="restore-session-wheel-roll size-12 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <p className="text-sm text-muted-foreground">{t('terminal.restoreSessionLoading')}</p>
      </div>
    </div>
  )
}
