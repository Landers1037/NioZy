import { useCallback, useEffect, useRef, useState } from 'react'
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { useDrawingSessionStore } from '@/stores/drawing-session-store'
import { getElectronAPI } from '@/lib/electron-client'
import { DrawingFileToolbar } from './DrawingFileToolbar'

const DEFAULT_FILE_NAME = 'untitled.excalidraw'

function parseExcalidrawFile(content: string): {
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
} | null {
  try {
    const data = JSON.parse(content) as Record<string, unknown>
    if (!data || typeof data !== 'object') return null
    return {
      elements: Array.isArray(data.elements) ? data.elements : undefined,
      appState:
        data.appState && typeof data.appState === 'object'
          ? (data.appState as Record<string, unknown>)
          : undefined,
      files:
        data.files && typeof data.files === 'object'
          ? (data.files as Record<string, unknown>)
          : undefined,
    }
  } catch {
    return null
  }
}

export function ExcalidrawEditor() {
  const { t } = useTranslation()
  const theme = useAppStore((s) => s.settings?.theme)
  const setDirty = useDrawingSessionStore((s) => s.setExcalidrawDirty)
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirtyLocal] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const skipDirtyRef = useRef(false)

  const markDirty = useCallback(
    (value: boolean) => {
      setDirtyLocal(value)
      setDirty(value)
    },
    [setDirty],
  )

  useEffect(() => {
    return () => {
      useDrawingSessionStore.getState().resetExcalidraw()
    }
  }, [])

  const serializeDocument = useCallback(() => {
    if (!api) return null
    return serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      'local',
    )
  }, [api])

  const handleNew = useCallback(() => {
    skipDirtyRef.current = true
    setFilePath(null)
    markDirty(false)
    setEditorKey((k) => k + 1)
    setApi(null)
  }, [markDirty])

  const handleOpen = useCallback(async () => {
    const result = await getElectronAPI().drawing.openFile('excalidraw')
    if (!result.ok) {
      if ('canceled' in result && result.canceled) return
      toast.error(t('drawing.openFailed'))
      return
    }
    const parsed = parseExcalidrawFile(result.content)
    if (!parsed) {
      toast.error(t('drawing.openFailed'))
      return
    }
    skipDirtyRef.current = true
    setFilePath(result.path)
    markDirty(false)
    setEditorKey((k) => k + 1)
    setApi(null)
    pendingLoadRef.current = parsed
  }, [markDirty, t])

  const pendingLoadRef = useRef<ReturnType<typeof parseExcalidrawFile>>(null)

  useEffect(() => {
    if (!api || !pendingLoadRef.current) return
    const parsed = pendingLoadRef.current
    pendingLoadRef.current = null
    api.updateScene({
      elements: parsed.elements as never,
      appState: parsed.appState as never,
    })
    if (parsed.files && typeof parsed.files === 'object') {
      const fileValues = Object.values(parsed.files).filter(
        (file): file is { mimeType: string; id: string; dataURL: string; created: number } =>
          !!file && typeof file === 'object' && 'dataURL' in file,
      )
      if (fileValues.length > 0) {
        api.addFiles(fileValues as never)
      }
    }
    skipDirtyRef.current = false
  }, [api])

  const saveToPath = useCallback(
    async (path: string | undefined, forceDialog: boolean) => {
      const content = serializeDocument()
      if (!content) return false
      const result = await getElectronAPI().drawing.saveFile({
        kind: 'excalidraw',
        content,
        defaultFileName: DEFAULT_FILE_NAME,
        filePath: forceDialog ? undefined : path,
      })
      if (!result.ok) {
        if ('canceled' in result && result.canceled) return false
        toast.error(t('drawing.saveFailed'))
        return false
      }
      setFilePath(result.path)
      markDirty(false)
      toast.success(t('drawing.saveSuccess'))
      return true
    },
    [markDirty, serializeDocument, t],
  )

  const handleSave = useCallback(async () => {
    await saveToPath(filePath ?? undefined, !filePath)
  }, [filePath, saveToPath])

  const handleSaveAs = useCallback(async () => {
    await saveToPath(undefined, true)
  }, [saveToPath])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DrawingFileToolbar
        filePath={filePath}
        dirty={dirty}
        disabled={!api}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
      />
      <div className="relative min-h-0 flex-1">
        <Excalidraw
          key={editorKey}
          excalidrawAPI={(instance) => setApi(instance)}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onChange={() => {
            if (skipDirtyRef.current) return
            markDirty(true)
          }}
        />
      </div>
    </div>
  )
}
