import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SidebarTerminalFilterProps {
  query: string
  onQueryChange: (query: string) => void
  onClose: () => void
  autoFocus?: boolean
}

export function SidebarTerminalFilter({
  query,
  onQueryChange,
  onClose,
  autoFocus = false,
}: SidebarTerminalFilterProps) {
  const { t } = useTranslation()

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5 no-drag">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <Input
        autoFocus={autoFocus}
        value={query}
        onInput={(e) => onQueryChange((e.target as HTMLInputElement).value)}
        placeholder={t('sidebar.terminalFilterPlaceholder')}
        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        aria-label={t('sidebar.terminalFilterPlaceholder')}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        title={t('sidebar.terminalFilterClose')}
        onClick={onClose}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
