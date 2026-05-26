import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'

interface SshReconnectHintProps {
  terminalId?: string
}

export function SshReconnectHint({ terminalId }: SshReconnectHintProps) {
  const { t } = useTranslation()
  const disconnected = useAppStore(
    (s) => !!(terminalId && s.sshDisconnectedTerminalIds[terminalId]),
  )

  if (!disconnected) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-2"
      role="status"
      aria-live="polite"
    >
      <p className="rounded-md border border-amber-500/30 bg-background/90 px-3 py-1.5 text-center text-xs text-amber-700 shadow-sm backdrop-blur-sm dark:text-amber-300">
        {t('terminal.sshReconnectHint')}
      </p>
    </div>
  )
}
