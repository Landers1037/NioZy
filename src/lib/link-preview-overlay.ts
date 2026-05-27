import { getElectronAPI } from '@/lib/electron-client'

let suppressCount = 0

/** 弹框打开期间隐藏链接预览 WebContentsView，避免盖住 HTML Dialog */
export function acquireLinkPreviewOverlaySuppression(): () => void {
  if (suppressCount++ === 0) {
    getElectronAPI().preview.setOverlaySuppressed(true)
  }
  return () => {
    if (suppressCount > 0 && --suppressCount === 0) {
      getElectronAPI().preview.setOverlaySuppressed(false)
    }
  }
}
