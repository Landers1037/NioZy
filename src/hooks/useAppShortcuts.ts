import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { matchAccelerator } from '@/lib/shortcut-utils'
import { getTerminal } from '@/lib/terminal-registry'
import { createTerminal } from '@/lib/terminal-actions'
import { handleTerminalKeyboardShortcut } from '@/lib/terminal-shortcut-actions'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'

export function useAppShortcuts(): void {
  const shortcuts = useAppStore((s) => s.settings?.shortcuts)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  useEffect(() => {
    if (!shortcuts) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const activeTab = tabs.find((t) => t.id === activeTabId)
      const app = shortcuts.app

      if (matchAccelerator(app.openSettings, e)) {
        e.preventDefault()
        addSettingsTab()
        return
      }

      if (matchAccelerator(app.newTerminal, e)) {
        e.preventDefault()
        void createTerminal()
        return
      }

      const terminalTabs = tabs.filter((t) => t.type === 'terminal')
      const terminalIndex = terminalTabs.findIndex((t) => t.id === activeTabId)

      if (matchAccelerator(app.prevTerminalTab, e)) {
        if (terminalIndex > 0) {
          e.preventDefault()
          setActiveTab(terminalTabs[terminalIndex - 1]!.id)
        }
        return
      }

      if (matchAccelerator(app.nextTerminalTab, e)) {
        if (terminalIndex >= 0 && terminalIndex < terminalTabs.length - 1) {
          e.preventDefault()
          setActiveTab(terminalTabs[terminalIndex + 1]!.id)
        }
        return
      }

      const activeTerminalId =
        activeTab?.type === 'terminal' ? getActiveTerminalId(activeTab) : undefined
      if (!activeTerminalId) return

      const term = getTerminal(activeTerminalId)
      if (!term) return

      if (handleTerminalKeyboardShortcut(term, activeTerminalId, app, e)) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, activeTabId, tabs, addSettingsTab, setActiveTab])
}
