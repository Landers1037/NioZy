import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppTab } from '@/stores/app-store'
import { SshReconnectHint } from '@/components/terminal/SshReconnectHint'
import { tryHandleSshReconnectEnter } from '@/lib/ssh-reconnect-actions'

interface SshDisconnectedPaneProps {
  tab: AppTab
  terminalId: string
}

/** SSH 会话已结束时替代 xterm/wterm：不接收输入与 write，仅展示断连提示与 Enter 重连 */
export function SshDisconnectedPane({ tab, terminalId }: SshDisconnectedPaneProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [terminalId])

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className="relative flex h-full w-full flex-col items-center justify-center outline-none"
      role="status"
      aria-live="polite"
      onKeyDown={(e) => {
        tryHandleSshReconnectEnter(tab, terminalId, e as unknown as KeyboardEvent)
      }}
    >
      <p className="max-w-md px-6 text-center text-sm text-amber-700 dark:text-amber-300">
        {t('terminal.processExited')}
      </p>
      <SshReconnectHint terminalId={terminalId} />
    </div>
  )
}
