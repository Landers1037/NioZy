import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Copy, Save, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getElectronAPI } from '@/lib/electron-client'

import 'tui-image-editor/dist/tui-image-editor.css'
import 'tui-color-picker/dist/tui-color-picker.css'

type Capture = {
  dataUrl: string
  width: number
  height: number
}

type Rect = { x: number; y: number; w: number; h: number }

function clampRect(r: Rect): Rect {
  const x = Math.min(r.x, r.x + r.w)
  const y = Math.min(r.y, r.y + r.h)
  const w = Math.abs(r.w)
  const h = Math.abs(r.h)
  return { x, y, w, h }
}

async function cropDataUrl(
  dataUrl: string,
  rectInView: Rect,
  viewSize: { w: number; h: number },
  imageSize: { w: number; h: number },
): Promise<string> {
  const rect = clampRect(rectInView)
  if (rect.w < 2 || rect.h < 2) return dataUrl

  const sx = imageSize.w / viewSize.w
  const sy = imageSize.h / viewSize.h
  const sx0 = Math.max(0, Math.floor(rect.x * sx))
  const sy0 = Math.max(0, Math.floor(rect.y * sy))
  const sw = Math.min(imageSize.w - sx0, Math.floor(rect.w * sx))
  const sh = Math.min(imageSize.h - sy0, Math.floor(rect.h * sy))

  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, sw)
  canvas.height = Math.max(1, sh)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, sx0, sy0, sw, sh, 0, 0, sw, sh)
  return canvas.toDataURL('image/png')
}

type EditorApi = {
  destroy: () => void
  loadImageFromURL: (url: string, name: string) => Promise<void>
  toDataURL: () => string
  ui?: {
    resizeEditor?: (size?: {
      uiSize?: { width: string; height: string }
      imageSize?: { oldWidth?: number; oldHeight?: number; newWidth?: number; newHeight?: number }
    }) => void
  }
}

function useTuiEditor(
  container: HTMLDivElement | null,
  initialDataUrl: string | null,
  editorRef: React.MutableRefObject<EditorApi | null>,
  onReady: () => void,
): void {

  useEffect(() => {
    if (!container) return

    let cancelled = false
    ;(async () => {
      const mod = await import('tui-image-editor')
      const ImageEditor = (mod as unknown as { default: new (el: HTMLElement, opts: unknown) => unknown }).default

      // 关键：includeUI 的 uiSize 用百分比在一些布局下会导致工具栏不显示
      // 这里用容器当前像素尺寸初始化
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))

      const instance = new ImageEditor(container, {
        includeUI: {
          loadImage: {
            path: initialDataUrl ?? '',
            name: 'screenshot',
          },
          theme: {},
          // 底部标注栏：文字/图形/涂鸦 + 打码（filter -> pixelate）
          menu: ['draw', 'shape', 'text', 'filter', 'crop'],
          initMenu: 'shape',
          uiSize: {
            width: `${w}px`,
            height: `${h}px`,
          },
          menuBarPosition: 'bottom',
        },
        // 关键：让图片初始按容器可视区 contain，而不是按原图尺寸“放大态”展示
        cssMaxWidth: w,
        cssMaxHeight: Math.max(1, h - 52),
        selectionStyle: {
          cornerSize: 12,
          rotatingPointOffset: 70,
        },
        usageStatistics: false,
      }) as unknown as EditorApi

      if (cancelled) {
        instance.destroy()
        return
      }

      editorRef.current = instance

      if (initialDataUrl) {
        try {
          await instance.loadImageFromURL(initialDataUrl, 'screenshot')
        } catch {
          // ignore
        }
      }
      onReady()
    })()

    return () => {
      cancelled = true
      editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [container, editorRef, onReady])

  useEffect(() => {
    if (!initialDataUrl) return
    if (!editorRef.current) return
    void editorRef.current.loadImageFromURL(initialDataUrl, 'screenshot')
  }, [initialDataUrl])
}

export function ScreenshotApp() {
  const { t } = useTranslation()
  const api = useMemo(() => getElectronAPI(), [])

  const [capture, setCapture] = useState<Capture | null>(null)
  const [phase, setPhase] = useState<'loading' | 'select' | 'edit'>('select')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [dragging, setDragging] = useState(false)
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  const pendingStartRef = useRef<{ x: number; y: number } | null>(null)
  const captureInFlightRef = useRef(false)

  const viewRef = useRef<HTMLDivElement | null>(null)
  const [editorHost, setEditorHost] = useState<HTMLDivElement | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const editorRef = useRef<EditorApi | null>(null)
  const markEditorReady = useCallback(() => setEditorReady(true), [])
  useTuiEditor(editorHost, croppedDataUrl, editorRef, markEditorReady)

  // 截图选择框阶段：强制窗口背景透明，避免出现“全屏白屏闪一下”
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    if (phase === 'select' || phase === 'loading') {
      html.style.background = 'transparent'
      body.style.background = 'transparent'
      if (root) root.style.background = 'transparent'
      return
    }

    // edit 阶段恢复默认（让编辑窗口按主题显示）
    html.style.background = ''
    body.style.background = ''
    if (root) root.style.background = ''
  }, [phase])

  const resetToSelect = () => {
    setLoadError(null)
    setSelection(null)
    setDragging(false)
    setCroppedDataUrl(null)
    setEditorReady(false)
    setCapture(null)
    pendingStartRef.current = null
    captureInFlightRef.current = false
    setPhase('select')
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        api.screenshot.close()
      }
      if (e.key === 'Enter' && phase === 'select' && selection && capture && viewRef.current) {
        void (async () => {
          const rect = selection
          const box = viewRef.current!.getBoundingClientRect()
          const next = await cropDataUrl(
            capture.dataUrl,
            rect,
            { w: box.width, h: box.height },
            { w: capture.width, h: capture.height },
          )
          setCroppedDataUrl(next)
          setPhase('edit')
        })()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [api, phase, selection, capture])

  const onMouseDown = (e: React.MouseEvent) => {
    if (phase !== 'select') return
    if (!viewRef.current) return
    const box = viewRef.current.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top

    // 关键：只有当用户开始框选（鼠标按下）时才抓屏，避免桌面动态变化时“提前截屏”
    if (!capture && !captureInFlightRef.current) {
      captureInFlightRef.current = true
      pendingStartRef.current = { x, y }
      setLoadError(null)
      setSelection(null)
      setDragging(false)
      setPhase('loading')
      void (async () => {
        try {
          const c = await api.screenshot.captureScreen()
          setCapture(c)
          const start = pendingStartRef.current
          if (start) {
            setSelection({ x: start.x, y: start.y, w: 0, h: 0 })
            setDragging(true)
          }
          setPhase('select')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          setLoadError(msg || 'CAPTURE_FAILED')
          captureInFlightRef.current = false
          setPhase('select')
        }
      })()
      return
    }

    if (!capture) return
    setSelection({ x, y, w: 0, h: 0 })
    setDragging(true)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    if (!selection) return
    if (!viewRef.current) return
    const box = viewRef.current.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    setSelection({ ...selection, w: x - selection.x, h: y - selection.y })
  }

  const onMouseUp = () => {
    if (!dragging) return
    setDragging(false)
    if (phase !== 'select') return
    // 松开鼠标即确认（类似微信/PixPin）
    if (!selection || !capture || !viewRef.current) return
    const rect = clampRect(selection)
    if (rect.w < 2 || rect.h < 2) return
    void confirmSelection()
  }

  const confirmSelection = async () => {
    if (!capture || !selection || !viewRef.current) return
    const box = viewRef.current.getBoundingClientRect()
    const next = await cropDataUrl(
      capture.dataUrl,
      selection,
      { w: box.width, h: box.height },
      { w: capture.width, h: capture.height },
    )
    setEditorReady(false)
    setCroppedDataUrl(next)
    setPhase('edit')
    api.screenshot.enterEditMode()
    // 进入编辑窗口后延迟触发一次 resize，确保图片按当前窗口可视区适配
    window.setTimeout(() => {
      const inst = editorRef.current
      if (inst?.ui?.resizeEditor) {
        try {
          inst.ui.resizeEditor()
        } catch {
          // ignore
        }
      }
    }, 100)
  }

  const copy = async () => {
    const dataUrl = editorRef.current?.toDataURL() ?? croppedDataUrl
    if (!dataUrl) return
    await api.screenshot.copyToClipboard(dataUrl)
  }

  const save = async () => {
    const dataUrl = editorRef.current?.toDataURL() ?? croppedDataUrl
    if (!dataUrl) return
    await api.screenshot.savePng(dataUrl)
  }

  useEffect(() => {
    if (!editorHost) return
    const onResize = () => {
      const inst = editorRef.current
      if (!inst?.ui?.resizeEditor) return
      const rect = editorHost.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      try {
        inst.ui.resizeEditor({
          uiSize: {
            width: `${w}px`,
            height: `${h}px`,
          },
          imageSize: {
            oldWidth: w,
            oldHeight: h,
            newWidth: w,
            newHeight: h,
          },
        })
      } catch {
        // ignore
      }
    }

    const ro = new ResizeObserver(() => onResize())
    ro.observe(editorHost)
    window.addEventListener('resize', onResize)
    onResize()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [editorHost])

  if (phase === 'loading') {
    return (
      <div className="h-full w-full bg-black/40 text-foreground flex items-center justify-center">
        <div className="rounded-lg bg-background/90 px-4 py-2 text-sm text-foreground shadow">
          {t('common.loading')}
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        phase === 'select'
          ? 'h-full w-full bg-transparent text-foreground'
          : 'screenshot-editor-window h-full w-full border border-border bg-background text-foreground shadow-2xl'
      }
    >
      {phase === 'select' ? (
        // 未抓屏前保持透明，只显示十字选择框（避免“全屏黑屏”）
        <div className="relative h-full w-full bg-transparent">
          <div
            ref={viewRef}
            className="absolute inset-0 cursor-crosshair select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            {capture ? (
              <img
                src={capture.dataUrl}
                alt="screenshot"
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 bg-transparent" />
            )}

            {/* 只有抓到背景图后才暗化桌面 */}
            {capture ? <div className="absolute inset-0 bg-black/15" /> : null}

            {selection ? (
              <div
                className={cn('absolute border-2 border-sky-400')}
                style={{
                  left: `${clampRect(selection).x}px`,
                  top: `${clampRect(selection).y}px`,
                  width: `${clampRect(selection).w}px`,
                  height: `${clampRect(selection).h}px`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.0)',
                }}
              >
                {/* 选区内显示原图：用透明遮罩“挖洞”效果 */}
                <div
                  className="absolute inset-0 bg-transparent"
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                />
              </div>
            ) : null}

            {!capture ? (
              <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                {t('screenshot.selectHint')}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          {loadError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
              <div className="text-sm text-muted-foreground">
                {t('screenshot.errorPrefix')}
                {loadError}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={resetToSelect}>
                  <RefreshCw className="mr-2 size-4" />
                  {t('screenshot.retry')}
                </Button>
                <Button variant="default" onClick={() => api.screenshot.close()}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="drag-region flex items-center gap-2 border-b border-border px-3 py-2">
                <div className="flex-1 text-sm font-medium text-foreground">
                  {t('screenshot.editTitle')}
                </div>
                <Button variant="outline" size="sm" className="no-drag" onClick={() => void copy()}>
                  <Copy className="mr-2 size-4" />
                  {t('screenshot.copy')}
                </Button>
                <Button variant="default" size="sm" className="no-drag" onClick={() => void save()}>
                  <Save className="mr-2 size-4" />
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="no-drag"
                  onClick={() => api.screenshot.close()}
                  aria-label={t('common.close')}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="h-[calc(100vh-44px)] w-full no-drag">
                {!croppedDataUrl ? (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {t('common.loading')}
                  </div>
                ) : (
                  <div className="screenshot-editor-host relative h-full w-full overflow-hidden">
                    {/* 编辑器挂载前先给一个预览，避免白屏 */}
                    {!editorReady ? (
                      <img
                        src={croppedDataUrl}
                        alt="preview"
                        className="pointer-events-none absolute inset-0 z-10 h-full w-full bg-black object-contain"
                        draggable={false}
                      />
                    ) : null}
                    <div ref={setEditorHost} className="h-full w-full" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

