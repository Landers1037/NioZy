import { useTranslation } from 'react-i18next'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { SftpTransferBody } from './SftpTransferBody'

interface SftpPanelProps {
  tab: AppTab
}

export function SftpPanel({ tab }: SftpPanelProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const connectionId = tab.sftpConnectionId

  const connection = settings?.connections.find(
    (c) => c.id === connectionId && (c.type === 'ssh' || c.type === 'sftp'),
  )

  return (
    <div className="flex h-full flex-col gap-3 p-1">
      <div className="flex shrink-0 flex-col gap-0.5 px-1">
        <p className="truncate text-sm font-semibold">{tab.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {connection
            ? t('scp.desc', { user: connection.sshUser, host: connection.sshHost })
            : t('scp.descGeneric')}
        </p>
      </div>
      {connectionId ? (
        <SftpTransferBody connectionId={connectionId} className="min-h-0 flex-1" />
      ) : (
        <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('scp.profileFailed')}
        </div>
      )}
    </div>
  )
}
