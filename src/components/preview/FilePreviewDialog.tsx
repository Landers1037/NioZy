import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { useTerminalPreviewStore } from '@/stores/terminal-preview-store'
import { DEFAULT_PREVIEW_SETTINGS } from '../../../electron/shared/preview-settings'
import { fileExtension } from '../../../electron/shared/terminal-preview-files'
import {
  jsPreviewKindFromExt,
  shouldUseJsPreviewDocument,
} from '@/lib/document-preview'
import { JsPreviewDocumentView } from '@/components/preview/JsPreviewDocumentView'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

export function FilePreviewDialog() {
  const { t } = useTranslation()
  const filePreview = useTerminalPreviewStore((s) => s.filePreview)
  const closeFilePreview = useTerminalPreviewStore((s) => s.closeFilePreview)
  const documentRenderMode =
    useAppStore((s) => s.settings?.preview.documentRenderMode) ??
    DEFAULT_PREVIEW_SETTINGS.documentRenderMode

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [tableRows, setTableRows] = useState<string[][] | null>(null)
  const [jsPreviewBuffer, setJsPreviewBuffer] = useState<ArrayBuffer | null>(null)
  const [jsPreviewKind, setJsPreviewKind] = useState<'docx' | 'excel' | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [zoom, setZoom] = useState(1)
  const previewRef = useRef<HTMLDivElement>(null)

  const filePath = filePreview?.filePath ?? null
  const fileName = filePreview?.fileName ?? ''
  const kind = filePreview?.kind ?? 'none'

  const clampZoom = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  )

  const zoomIn = useCallback(() => {
    setZoom((z) => clampZoom(Math.round((z + ZOOM_STEP) * 100) / 100))
  }, [clampZoom])

  const zoomOut = useCallback(() => {
    setZoom((z) => clampZoom(Math.round((z - ZOOM_STEP) * 100) / 100))
  }, [clampZoom])

  const resetZoom = useCallback(() => setZoom(1), [])

  useEffect(() => {
    if (!filePath || kind === 'none') {
      setImageUrl(null)
      setPdfUrl(null)
      setTextContent(null)
      setHtmlContent(null)
      setTableRows(null)
      setJsPreviewBuffer(null)
      setJsPreviewKind(null)
      setError(null)
      setTruncated(false)
      setZoom(1)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setImageUrl(null)
    setPdfUrl(null)
    setTextContent(null)
    setHtmlContent(null)
    setTableRows(null)
    setJsPreviewBuffer(null)
    setJsPreviewKind(null)
    setTruncated(false)
    setZoom(1)

    void (async () => {
      const result = await getElectronAPI().files.getTerminalFilePreviewUrl(filePath, kind)
      if (cancelled) return
      if (!result.ok || !result.url) {
        setLoading(false)
        setError(result.error ?? t('settings.preview.previewFailed'))
        return
      }

      const url = result.url
      const ext = fileExtension(filePath)

      if (kind === 'image') {
        setImageUrl(url)
        setLoading(false)
        return
      }

      if (ext === '.pdf') {
        setPdfUrl(url)
        setLoading(false)
        return
      }

      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(String(res.status))
        setTruncated(res.headers.get('X-NioZy-Truncated') === '1')

        if (shouldUseJsPreviewDocument(documentRenderMode, ext)) {
          const buf = await res.arrayBuffer()
          const previewKind = jsPreviewKindFromExt(ext)
          if (cancelled || !previewKind) return
          setJsPreviewBuffer(buf)
          setJsPreviewKind(previewKind)
          setLoading(false)
          return
        }

        if (ext === '.docx') {
          const buf = await res.arrayBuffer()
          const converted = await mammoth.convertToHtml({ arrayBuffer: buf })
          if (cancelled) return
          setHtmlContent(converted.value)
          setLoading(false)
          return
        }

        if (ext === '.xlsx' || ext === '.csv') {
          const buf = await res.arrayBuffer()
          const wb = XLSX.read(buf, { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          if (!sheet) {
            setTextContent('')
          } else {
            const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
              header: 1,
              defval: '',
            }) as string[][]
            setTableRows(rows.slice(0, 500))
          }
          setLoading(false)
          return
        }

        const text = await res.text()
        if (cancelled) return
        setTextContent(text)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setError(err instanceof Error ? err.message : t('settings.preview.previewFailed'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filePath, kind, documentRenderMode, t])

  useEffect(() => {
    const el = previewRef.current
    if (!el || !imageUrl) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [imageUrl, clampZoom])

  const zoomPercent = Math.round(zoom * 100)
  const showImageZoom = !!imageUrl && !loading && !error
  const showJsPreview = !loading && !error && jsPreviewBuffer && jsPreviewKind

  return (
    <Dialog open={filePath !== null} onOpenChange={(open) => !open && closeFilePreview()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-3">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0">
          <DialogTitle className="min-w-0 flex-1 truncate pr-2">{fileName}</DialogTitle>
          {showImageZoom && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                title={t('filesystem.previewZoomOut')}
                disabled={zoom <= MIN_ZOOM}
                onClick={zoomOut}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
                {zoomPercent}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                title={t('filesystem.previewZoomIn')}
                disabled={zoom >= MAX_ZOOM}
                onClick={zoomIn}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                title={t('filesystem.previewZoomReset')}
                disabled={zoom === 1}
                onClick={resetZoom}
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          )}
        </DialogHeader>
        {truncated && (
          <p className="text-xs text-muted-foreground">{t('settings.preview.truncatedNotice')}</p>
        )}
        <div
          ref={previewRef}
          className="flex min-h-[200px] max-h-[calc(90vh-8rem)] items-start justify-center overflow-auto rounded-md border border-border bg-muted/30 p-2"
        >
          {loading && (
            <div className="flex w-full items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t('common.loading')}
            </div>
          )}
          {!loading && error && (
            <p className="w-full text-sm text-destructive">{error}</p>
          )}
          {!loading && imageUrl && (
            <img
              src={imageUrl}
              alt={fileName}
              draggable={false}
              className={cn('object-contain transition-transform duration-150')}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                maxHeight: zoom <= 1 ? '100%' : undefined,
                maxWidth: zoom <= 1 ? '100%' : undefined,
              }}
            />
          )}
          {!loading && pdfUrl && (
            <iframe
              src={pdfUrl}
              title={fileName}
              className="h-[min(70vh,720px)] w-full min-h-[320px] border-0 bg-background"
            />
          )}
          {showJsPreview && filePath && (
            <JsPreviewDocumentView
              key={`${filePath}:${documentRenderMode}`}
              kind={jsPreviewKind}
              data={jsPreviewBuffer}
            />
          )}
          {!loading && htmlContent && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none w-full overflow-auto p-2 text-sm"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
          {!loading && tableRows && (
            <div className="w-full overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <tbody>
                  {tableRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/60">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 align-top">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading &&
            textContent !== null &&
            !htmlContent &&
            !tableRows &&
            !pdfUrl &&
            !showJsPreview && (
            <pre className="w-full whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
              {textContent}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
