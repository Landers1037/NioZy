import { useTranslation } from 'react-i18next'
import { Moon } from 'lucide-react'

interface InactiveTerminalPlaceholderProps {
  tabId: string
}

export function InactiveTerminalPlaceholder({ tabId }: InactiveTerminalPlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
      data-tab-id={tabId}
    >
      <Moon className="size-8 opacity-40" strokeWidth={1.5} />
      <p className="text-sm">{t('terminal.inactiveOptimized')}</p>
    </div>
  )
}
