import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AppTab } from '@/stores/app-store'
import { getSshConnection } from '@/lib/ssh-connection'
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { SftpTransferBody } from './SftpTransferBody'

interface ScpTransferDialogProps {
  tab: AppTab
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScpTransferDialog({ tab, open, onOpenChange }: ScpTransferDialogProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)

  const connection = getSshConnection(settings, tab.sshConnectionId)
  const connectionId = tab.sshConnectionId
  const displayTitle = getTabDisplayTitle(tab)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('scp.title', { title: displayTitle })}</DialogTitle>
          <DialogDescription>
            {connection
              ? t('scp.desc', {
                  user: connection.sshUser,
                  host: connection.sshHost,
                })
              : t('scp.descGeneric')}
          </DialogDescription>
        </DialogHeader>

        {connectionId ? (
          <SftpTransferBody
            connectionId={connectionId}
            onProfileFailed={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('scp.profileFailed')}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
