import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { matchAccelerator } from '@/lib/shortcut-utils'
import { getTerminal } from '@/lib/terminal-registry'
import { createTerminal } from '@/lib/terminal-actions'
import { toast } from 'sonner'

export function useAppShortcuts(): void {
  const shortcuts = useAppStore((s) => s.settings?.shortcuts)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const addSettingsTab = useAppStore((s) => s.addSettingsTab)

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
        void createTerminal('powershell')
        return
      }

      if (activeTab?.type !== 'terminal' || !activeTab.terminalId) return

      const term = getTerminal(activeTab.terminalId)
      if (!term) return

      if (matchAccelerator(app.copyToClipboard, e)) {
        e.preventDefault()
        const text = term.getSelection()
        if (text) void navigator.clipboard.writeText(text)
        else toast.message('请先选中终端内容')
        return
      }

      if (matchAccelerator(app.pasteFromClipboard, e)) {
        e.preventDefault()
        void navigator.clipboard.readText().then((text) => {
          if (text) getElectronAPI().terminal.write(activeTab.terminalId!, text)
        })
        return
      }

      if (matchAccelerator(app.lineStart, e)) {
        e.preventDefault()
        getElectronAPI().terminal.write(activeTab.terminalId!, '\x01')
        return
      }

      if (matchAccelerator(app.lineEnd, e)) {
        e.preventDefault()
        getElectronAPI().terminal.write(activeTab.terminalId!, '\x05')
        return
      }

      if (matchAccelerator(app.clearTerminal, e)) {
        e.preventDefault()
        term.clear()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, activeTabId, tabs, addSettingsTab])
}
