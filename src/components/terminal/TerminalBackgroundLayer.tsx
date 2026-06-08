import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../electron/shared/api-types'
import {
  fetchTerminalBackgroundUrl,
  getTerminalBackgroundOpacity,
  getTerminalChromeBackgroundColor,
} from '@/lib/terminal-background'
import { useTerminalBackgroundPreviewStore } from '@/stores/terminal-background-preview-store'
import { cn } from '@/lib/utils'

type Props = {
  terminal: AppSettings['terminal'] | undefined
  className?: string
}

/** 终端 Tab 层底层背景图（置于 TerminalTabLayer 根容器内） */
export function TerminalBackgroundLayer({ terminal, className }: Props) {
  const ext = terminal?.backgroundImageExt
  const previewOpacity = useTerminalBackgroundPreviewStore((s) => s.previewOpacity)
  const imageRevision = useTerminalBackgroundPreviewStore((s) => s.imageRevision)
  const opacity = previewOpacity ?? getTerminalBackgroundOpacity(terminal)
  const chromeBackground = getTerminalChromeBackgroundColor(terminal)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!ext) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetchTerminalBackgroundUrl(ext).then((next) => {
      if (!cancelled) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [ext, imageRevision])

  if (!url) return null

  return (
    <div
      className={cn(className, 'overflow-hidden')}
      aria-hidden
      style={{ backgroundColor: chromeBackground }}
    >
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: opacity / 100,
        }}
      />
    </div>
  )
}
