import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { matchAccelerator } from '@/lib/shortcut-utils'
import { getTerminal } from '@/lib/terminal-registry'
import { createTerminal } from '@/lib/terminal-actions'
import {
  handleTerminalCopyWhenSelection,
  handleTerminalKeyboardShortcut,
} from '@/lib/terminal-shortcut-actions'
import {
  handleTerminalTabNavigationShortcut,
  isFormTypingTarget,
} from '@/lib/app-shortcut-actions'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { useCommandPaletteStore } from '@/stores/command-palette-store'

export function useAppShortcuts(): void {
  const shortcuts = useAppStore((s) => s.settings?.shortcuts)

  useEffect(() => {
    if (!shortcuts) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const app = shortcuts.app

      if (matchAccelerator(app.commandPalette, e)) {
        e.preventDefault()
        e.stopPropagation()
        useCommandPaletteStore.getState().togglePalette()
        return
      }

      if (useCommandPaletteStore.getState().open) return

      if (isFormTypingTarget(target)) return
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

      if (handleTerminalCopyWhenSelection(e, term)) {
        e.stopPropagation()
        return
      }

      if (handleTerminalKeyboardShortcut(activeTerminalId, app, e, term)) {
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [shortcuts])
}
