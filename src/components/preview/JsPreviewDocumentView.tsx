import { useEffect, useRef } from 'react'
import jsPreviewDocx from '@js-preview/docx'
import jsPreviewExcel from '@js-preview/excel'
import '@js-preview/docx/lib/index.css'
import '@js-preview/excel/lib/index.css'
import { enqueueJsPreview, withMutedJsPreviewLibraryLogs } from '@/lib/js-preview-session'

export type JsPreviewDocumentKind = 'docx' | 'excel'

interface JsPreviewDocumentViewProps {
  kind: JsPreviewDocumentKind
  data: ArrayBuffer
}

export function JsPreviewDocumentView({ kind, data }: JsPreviewDocumentViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let previewer: { destroy: () => void; preview: (src: ArrayBuffer) => Promise<unknown> } | null =
      null

    const loadPromise = enqueueJsPreview(async () => {
      if (cancelled) return

      const mount = document.createElement('div')
      mount.className = 'h-full w-full min-h-[inherit]'
      host.replaceChildren(mount)

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      if (cancelled || !host.isConnected) return

      previewer =
        kind === 'docx' ? jsPreviewDocx.init(mount) : jsPreviewExcel.init(mount)

      if (cancelled) {
        try {
          previewer.destroy()
        } catch {
          /* ignore */
        }
        previewer = null
        return
      }

      const buffer = data.slice(0)
      const runPreview = () => previewer!.preview(buffer)
      await (kind === 'excel' ? withMutedJsPreviewLibraryLogs(runPreview) : runPreview())
    })

    void loadPromise.catch(() => {
      /* 渲染失败由外层弹窗提示；避免未捕获 rejection */
    })

    return () => {
      cancelled = true
      void enqueueJsPreview(async () => {
        await loadPromise.catch(() => {})
        try {
          previewer?.destroy()
        } catch {
          /* destroy 在竞态下可能抛错 */
        }
        previewer = null
        if (host.isConnected) {
          host.replaceChildren()
        }
      })
    }
  }, [kind, data])

  return (
    <div
      ref={hostRef}
      className="js-preview-document-root min-h-[min(70vh,720px)] w-full overflow-auto bg-background"
    />
  )
}
