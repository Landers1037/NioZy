import { KeyRound, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppTab } from '@/stores/app-store'
import { useIsSshDeferredConnecting } from '@/lib/ssh-deferred-connect'

interface SshDeferredConnectPaneProps {
  tab: AppTab
}

/** SSH 动态密码 Tab 未连接时的占位视图 */
export function SshDeferredConnectPane({ tab }: SshDeferredConnectPaneProps) {
  const { t } = useTranslation()
  const connecting = useIsSshDeferredConnecting(tab.id)

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground"
      data-tab-id={tab.id}
      role="status"
      aria-live="polite"
    >
      {connecting ? (
        <Loader2 className="size-8 animate-spin opacity-60" strokeWidth={1.5} />
      ) : (
        <KeyRound className="size-8 opacity-40" strokeWidth={1.5} />
      )}
      <p className="max-w-md text-sm">
        {connecting ? t('terminal.sshDeferredConnecting') : t('terminal.sshDeferredIdle')}
      </p>
    </div>
  )
}
