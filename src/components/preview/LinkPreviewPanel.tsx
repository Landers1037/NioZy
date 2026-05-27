import { useEffect, useRef } from 'react'
import type { AppTab } from '@/stores/app-store'

interface LinkPreviewPanelProps {
  tab: AppTab
}

/**
 * Renders an external URL using Electron's <webview> guest-page element.
 * The webview runs in its own renderer process with full network access,
 * completely separate from the app shell – no native-layer coordinate
 * juggling required.
 */
export function LinkPreviewPanel({ tab }: LinkPreviewPanelProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !tab.webviewUrl) return
    el.setAttribute('allowpopups', 'true')
    if (el.getAttribute('src') !== tab.webviewUrl) {
      el.setAttribute('src', tab.webviewUrl)
    }
  }, [tab.webviewUrl])

  if (!tab.webviewUrl) return null

  return (
    <webview
      ref={ref}
      src={tab.webviewUrl}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'flex',
      }}
    />
  )
}
