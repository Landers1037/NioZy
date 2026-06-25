import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { createTerminal } from '@/lib/terminal-actions'
import { createMuxTerminal } from '@/lib/mux-terminal-actions'
import { isMuxCoreEnabled } from '@/lib/mux-terminal-render'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import {
  MUX_LAYOUT_OPTIONS,
  type MuxLayoutKind,
} from '../../../electron/shared/mux-terminal-types'

interface NewTerminalButtonProps {
  iconOnly?: boolean
  className?: string
}

function muxLayoutLabel(kind: MuxLayoutKind, t: (key: string) => string): string {
  if (kind === '1') return t('settings.experimental.muxPaneCount1')
  if (kind === '2x1') return t('settings.experimental.muxPaneCount2')
  if (kind === '1x2') return t('settings.experimental.muxPaneCount1x2')
  return t('settings.experimental.muxPaneCount4')
}

export function NewTerminalButton({ iconOnly, className }: NewTerminalButtonProps) {
  const { t } = useTranslation()
  const muxEnabled = isMuxCoreEnabled(useAppStore((s) => s.settings))

  const button = (
    <Button
      variant="secondary"
      size={iconOnly ? 'icon' : 'default'}
      className={cn(
        !iconOnly && 'min-w-0 flex-1 basis-0 overflow-hidden px-2',
        iconOnly && 'size-6',
        className,
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void createTerminal()}
      title={
        muxEnabled
          ? `${t('sidebar.newPowerShell')} (${t('sidebar.newMuxTerminalRightClick')})`
          : t('sidebar.newPowerShell')
      }
    >
      <Plus className={cn('shrink-0', iconOnly ? 'size-3' : 'size-4')} />
      {!iconOnly && <span className="min-w-0 truncate">{t('sidebar.newTerminal')}</span>}
    </Button>
  )

  if (!muxEnabled) return button

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
      <ContextMenuContent>
        {MUX_LAYOUT_OPTIONS.map((kind) => (
          <ContextMenuItem key={kind} onSelect={() => void createMuxTerminal(undefined, kind)}>
            {muxLayoutLabel(kind, t)}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
