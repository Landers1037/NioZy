import { useEffect } from 'react'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { setTerminalRenderPaused } from '@/lib/terminal-render-pause'

/**
 * 标题栏 drag-region 按下时立即暂停终端渲染与主进程 IPC 推流。
 * Windows 下 -webkit-app-region: drag 不一定触发 will-move，需渲染层主动通知主进程。
 */
export function useWindowTitleDragPause(): {
  onTitleBarPointerDownCapture: (e: React.PointerEvent) => void
} {
  useEffect(() => {
    if (!isElectron()) return

    const endDrag = (): void => {
      setTerminalRenderPaused(false)
      getElectronAPI().window.setDragging(false)
    }

    window.addEventListener('pointerup', endDrag, true)
    window.addEventListener('pointercancel', endDrag, true)
    window.addEventListener('blur', endDrag)

    return () => {
      window.removeEventListener('pointerup', endDrag, true)
      window.removeEventListener('pointercancel', endDrag, true)
      window.removeEventListener('blur', endDrag)
      setTerminalRenderPaused(false)
      getElectronAPI().window.setDragging(false)
    }
  }, [])

  const onTitleBarPointerDownCapture = (e: React.PointerEvent): void => {
    if (!isElectron() || e.button !== 0) return
    const target = e.target
    if (!(target instanceof Element)) return
    if (target.closest('.no-drag')) return

    setTerminalRenderPaused(true)
    getElectronAPI().window.setDragging(true)
  }

  return { onTitleBarPointerDownCapture }
}
