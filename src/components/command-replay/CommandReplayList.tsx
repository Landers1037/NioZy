import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CommandReplayItem } from '../../../electron/shared/command-replay'
import { cn } from '@/lib/utils'

interface CommandReplayListProps {
  items: CommandReplayItem[]
  variant: 'settings' | 'panel'
  onReplay?: (item: CommandReplayItem) => void
  onEdit?: (item: CommandReplayItem) => void
  onDelete?: (item: CommandReplayItem) => void
  className?: string
}

export function CommandReplayList({
  items,
  variant,
  onReplay,
  onEdit,
  onDelete,
  className,
}: CommandReplayListProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p className={cn('px-2 py-6 text-center text-xs text-muted-foreground', className)}>
        {t('commandReplay.listEmpty')}
      </p>
    )
  }

  return (
    <ul
      className={cn(
        'h-48 overflow-y-auto rounded-md border border-border/70 bg-muted/10',
        className,
      )}
      role="listbox"
      aria-label={t('commandReplay.listAria')}
    >
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-1 border-b border-border/50 px-2 py-1.5 last:border-b-0"
        >
          {variant === 'panel' ? (
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left text-xs hover:bg-accent/60 focus:outline-none focus:ring-1 focus:ring-ring/40"
              onMouseDown={keepTerminalFocus}
              onClick={() => onReplay?.(item)}
              title={t('commandReplay.replayHint')}
            >
              <span className="block truncate font-medium text-foreground">{item.name}</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                {formatCommandPreview(item.command)}
              </span>
            </button>
          ) : (
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {formatCommandPreview(item.command)}
              </p>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            {variant === 'panel' && onReplay ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t('commandReplay.replay')}
                title={t('commandReplay.replay')}
                onMouseDown={keepTerminalFocus}
                onClick={() => onReplay(item)}
              >
                <Play className="size-3.5" />
              </Button>
            ) : null}
            {onEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t('common.edit')}
                onClick={() => onEdit(item)}
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                aria-label={t('commandReplay.delete')}
                onClick={() => onDelete(item)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatCommandPreview(command: string): string {
  return command.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
}

/** 避免点击面板控件时抢走终端输入焦点 */
function keepTerminalFocus(e: MouseEvent) {
  e.preventDefault()
}
