import { useEffect, useRef } from 'react'
import { getElectronAPI } from '@/lib/electron-client'
import type { AppTab } from '@/stores/app-store'

interface LinkPreviewPanelProps {
  tab: AppTab
}

function readHostBounds(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

/** 占位容器：主进程 WebContentsView 叠放在此区域上方 */
export function LinkPreviewPanel({ tab }: LinkPreviewPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = tab.webviewUrl
    if (!url) return

    const api = getElectronAPI()
    let disposed = false

    const mount = () => {
      if (disposed) return
      const el = hostRef.current
      if (!el) return

      const bounds = readHostBounds(el)
      api.preview.openLink(tab.id, url, bounds)

      const pushBounds = () => {
        if (disposed) return
        const host = hostRef.current
        if (!host) return
        const next = readHostBounds(host)
        if (next.width > 0 && next.height > 0) {
          api.preview.setBounds(tab.id, next)
        }
      }

      pushBounds()
      const ro = new ResizeObserver(pushBounds)
      ro.observe(el)
      window.addEventListener('resize', pushBounds)

      return () => {
        ro.disconnect()
        window.removeEventListener('resize', pushBounds)
      }
    }

    let cleanupLayout: (() => void) | undefined
    let frame1 = 0
    let frame2 = 0
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        cleanupLayout = mount()
      })
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      cleanupLayout?.()
      api.preview.close(tab.id)
    }
  }, [tab.id, tab.webviewUrl])

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 bg-background"
      data-link-preview-host={tab.id}
    />
  )
}
