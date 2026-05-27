import { useMemo } from 'react'
import type { AppTab } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import { TerminalView } from '@/components/terminal/TerminalView'
import { useAttachPtySessionStore } from '@/stores/attach-pty-session-store'

export function AttachPtyTerminalHost() {
  const committed = useAttachPtySessionStore((s) => s.committed)
  const tabs = useAppStore((s) => s.tabs)

  const tab = useMemo(
    () => (committed ? tabs.find((t) => t.id === committed.tabId) : undefined),
    [committed, tabs],
  )

  if (!committed || !tab || tab.type !== 'terminal') return null

  const sessionTab: AppTab = { ...tab, terminalId: committed.terminalId }

  return (
    <div className="pointer-events-auto absolute inset-0 z-10">
      <TerminalView
        tab={sessionTab}
        attachSession={committed}
        isFocused
        preferDomRenderer={false}
      />
    </div>
  )
}
