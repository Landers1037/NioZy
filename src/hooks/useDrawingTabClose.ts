import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useDrawingSessionStore } from '@/stores/drawing-session-store'

export function useDrawingTabClose(tabId: string, kind: 'excalidraw' | 'drawio') {
  const removeTab = useAppStore((s) => s.removeTab)
  const dirty =
    kind === 'excalidraw'
      ? useDrawingSessionStore((s) => s.excalidrawDirty)
      : useDrawingSessionStore((s) => s.drawioDirty)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestClose = () => {
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    removeTab(tabId)
  }

  const confirmClose = () => {
    if (kind === 'excalidraw') {
      useDrawingSessionStore.getState().resetExcalidraw()
    } else {
      useDrawingSessionStore.getState().resetDrawio()
    }
    removeTab(tabId)
    setConfirmOpen(false)
  }

  return { confirmOpen, setConfirmOpen, requestClose, confirmClose, dirty }
}
