import { useTranslation } from 'react-i18next'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { FtpTransferBody } from './FtpTransferBody'

interface FtpPanelProps {
  tab: AppTab
}

export function FtpPanel({ tab }: FtpPanelProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const connectionId = tab.ftpConnectionId

  const connection = settings?.connections.find(
    (c) => c.id === connectionId && c.type === 'ftp',
  )

  return (
    <div className="flex h-full flex-col gap-3 p-1">
      <div className="flex shrink-0 flex-col gap-0.5 px-1">
        <p className="truncate text-sm font-semibold">{tab.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {connection
            ? t('ftp.desc', { user: connection.ftpUser, host: connection.ftpHost })
            : t('ftp.descGeneric')}
        </p>
      </div>
      {connectionId ? (
        <FtpTransferBody connectionId={connectionId} className="min-h-0 flex-1" />
      ) : (
        <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('ftp.profileFailed')}
        </div>
      )}
    </div>
  )
}
