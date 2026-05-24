import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { matchAccelerator } from '@/lib/shortcut-utils'
import { getTerminal } from '@/lib/terminal-registry'
import { createTerminal } from '@/lib/terminal-actions'
import { handleTerminalKeyboardShortcut } from '@/lib/terminal-shortcut-actions'
import {
  handleTerminalTabNavigationShortcut,
  isFormTypingTarget,
} from '@/lib/app-shortcut-actions'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'

export function useAppShortcuts(): void {
  const shortcuts = useAppStore((s) => s.settings?.shortcuts)

  useEffect(() => {
    if (!shortcuts) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (isFormTypingTarget(target)) return

      const app = shortcuts.app
      const { tabs, activeTabId, addSettingsTab } = useAppStore.getState()

      if (matchAccelerator(app.openSettings, e)) {
        e.preventDefault()
        e.stopPropagation()
        addSettingsTab()
        return
      }

      if (matchAccelerator(app.newTerminal, e)) {
        e.preventDefault()
        e.stopPropagation()
        void createTerminal()
        return
      }

      if (handleTerminalTabNavigationShortcut(e)) return

      const activeTab = tabs.find((t) => t.id === activeTabId)
      const activeTerminalId =
        activeTab?.type === 'terminal' ? getActiveTerminalId(activeTab) : undefined
      if (!activeTerminalId) return

      const term = getTerminal(activeTerminalId)
      if (!term) return

      if (handleTerminalKeyboardShortcut(term, activeTerminalId, app, e)) {
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [shortcuts])
}
