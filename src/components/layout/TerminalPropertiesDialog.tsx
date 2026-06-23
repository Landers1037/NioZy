import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import {
  buildTerminalTabPropertyRows,
  formatTerminalPropertyCreatedAt,
} from '@/lib/terminal-tab-properties'

interface TerminalPropertiesDialogProps {
  tabId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function resolvePropertyValue(
  value: string,
  t: (key: string) => string,
): string {
  if (value.startsWith('settings.') || value.startsWith('common.') || value.startsWith('tab.')) {
    const translated = t(value)
    if (translated !== value) return translated
  }
  return value
}

export function TerminalPropertiesDialog({
  tabId,
  open,
  onOpenChange,
}: TerminalPropertiesDialogProps) {
  const { t, i18n } = useTranslation()
  const tab = useAppStore((s) => s.tabs.find((item) => item.id === tabId))
  const settings = useAppStore((s) => s.settings)
  const terminalCwds = useAppStore((s) => s.terminalCwds)

  const rows = useMemo(() => {
    if (!tab || tab.type !== 'terminal') return []
    return buildTerminalTabPropertyRows(tab, settings, terminalCwds).map((row) => {
      if (row.labelKey === 'tab.terminalPropertiesCreatedAt') {
        const formatted = formatTerminalPropertyCreatedAt(row.value, i18n.language)
        return formatted ? { ...row, value: formatted } : null
      }
      return {
        ...row,
        value: resolvePropertyValue(row.value, t),
      }
    }).filter((row): row is NonNullable<typeof row> => row !== null)
  }, [tab, settings, terminalCwds, i18n.language, t])

  const displayTitle = tab ? getTabDisplayTitle(tab) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md select-none">
        <DialogHeader>
          <DialogTitle>{t('tab.terminalPropertiesTitle')}</DialogTitle>
          <DialogDescription>
            {t('tab.terminalPropertiesDesc', { title: displayTitle })}
          </DialogDescription>
        </DialogHeader>
        {tab?.type === 'terminal' ? (
          <dl className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-3 text-sm">
            {rows.map((row) => (
              <div key={row.labelKey} className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">{t(row.labelKey)}</dt>
                <dd
                  className={
                    row.monospace
                      ? 'break-all font-mono text-xs leading-relaxed'
                      : 'break-words'
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
