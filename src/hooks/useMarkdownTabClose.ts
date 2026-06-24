import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'
import { scheduleOverlayOpen } from '@/lib/context-menu-overlay'

export function useMarkdownTabClose(tabId: string) {
  const removeTab = useAppStore((s) => s.removeTab)
  const dirty = useMarkdownEditorStore((s) => s.sessions[tabId]?.dirty ?? false)
  const removeSession = useMarkdownEditorStore((s) => s.removeSession)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestClose = () => {
    if (dirty) {
      scheduleOverlayOpen(() => setConfirmOpen(true))
      return
    }
    removeSession(tabId)
    removeTab(tabId)
  }

  const confirmClose = () => {
    removeSession(tabId)
    removeTab(tabId)
    setConfirmOpen(false)
  }

  return { confirmOpen, setConfirmOpen, requestClose, confirmClose, dirty }
}
