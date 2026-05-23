import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

interface FilesystemImagePreviewDialogProps {
  filePath: string | null
  fileName: string
  onOpenChange: (open: boolean) => void
}

export function FilesystemImagePreviewDialog({
  filePath,
  fileName,
  onOpenChange,
}: FilesystemImagePreviewDialogProps) {
  const { t } = useTranslation()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

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
    if (!filePath) {
      setDataUrl(null)
      setError(null)
      setZoom(1)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDataUrl(null)
    setZoom(1)
    void (async () => {
      const result = await getElectronAPI().files.readImagePreview(filePath)
      if (cancelled) return
      setLoading(false)
      if (result.ok && result.dataUrl) {
        setDataUrl(result.dataUrl)
      } else {
        setError(result.error ?? t('filesystem.previewFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath, t])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!dataUrl) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100))
    },
    [dataUrl, clampZoom],
  )

  const zoomPercent = Math.round(zoom * 100)

  return (
    <Dialog open={filePath !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-3">
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0">
          <DialogTitle className="min-w-0 flex-1 truncate pr-2">{fileName}</DialogTitle>
          {dataUrl && !loading && !error && (
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
        <div
          className="flex min-h-[200px] max-h-[calc(90vh-8rem)] items-center justify-center overflow-auto rounded-md border border-border bg-muted/30 p-2"
          onWheel={handleWheel}
        >
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t('common.loading')}
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && dataUrl && (
            <img
              src={dataUrl}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
