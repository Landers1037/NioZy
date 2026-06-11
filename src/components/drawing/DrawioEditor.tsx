import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { useDrawingSessionStore } from '@/stores/drawing-session-store'
import { getElectronAPI } from '@/lib/electron-client'
import { resolveDrawioBaseUrl } from '@/lib/drawio-base-url'
import { DrawingFileToolbar } from './DrawingFileToolbar'

const DEFAULT_FILE_NAME = 'untitled.drawio'

const EMPTY_DRAWIO_XML = `<mxfile host="app.diagrams.net">
  <diagram name="Page-1" id="page-1">
    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`

export function DrawioEditor() {
  const { t } = useTranslation()
  const theme = useAppStore((s) => s.settings?.theme)
  const setDirty = useDrawingSessionStore((s) => s.setDrawioDirty)
  const drawioRef = useRef<DrawIoEmbedRef>(null)
  const latestXmlRef = useRef(EMPTY_DRAWIO_XML)
  const skipDirtyRef = useRef(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirtyLocal] = useState(false)
  const [xml, setXml] = useState(EMPTY_DRAWIO_XML)
  const [ready, setReady] = useState(false)

  const markDirty = useCallback(
    (value: boolean) => {
      setDirtyLocal(value)
      setDirty(value)
    },
    [setDirty],
  )

  useEffect(() => {
    return () => {
      useDrawingSessionStore.getState().resetDrawio()
    }
  }, [])

  const requestXml = useCallback((): string | null => {
    const xml = latestXmlRef.current.trim()
    return xml || null
  }, [])

  const handleNew = useCallback(() => {
    skipDirtyRef.current = true
    latestXmlRef.current = EMPTY_DRAWIO_XML
    setXml(EMPTY_DRAWIO_XML)
    setFilePath(null)
    markDirty(false)
    setReady(false)
  }, [markDirty])

  const handleOpen = useCallback(async () => {
    const result = await getElectronAPI().drawing.openFile('drawio')
    if (!result.ok) {
      if ('canceled' in result && result.canceled) return
      toast.error(t('drawing.openFailed'))
      return
    }
    skipDirtyRef.current = true
    latestXmlRef.current = result.content
    setXml(result.content)
    setFilePath(result.path)
    markDirty(false)
    setReady(false)
    queueMicrotask(() => {
      drawioRef.current?.load({ xml: result.content })
      skipDirtyRef.current = false
    })
  }, [markDirty, t])

  const saveToPath = useCallback(
    async (path: string | undefined, forceDialog: boolean) => {
      const content = requestXml()
      if (!content) {
        toast.error(t('drawing.saveFailed'))
        return false
      }
      const result = await getElectronAPI().drawing.saveFile({
        kind: 'drawio',
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
    [markDirty, requestXml, t],
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
        disabled={!ready}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
      />
      <div className="relative min-h-0 flex-1">
        <DrawIoEmbed
          ref={drawioRef}
          baseUrl={resolveDrawioBaseUrl()}
          xml={xml}
          autosave
          urlParameters={{
            ui: 'kennedy',
            libraries: true,
            saveAndExit: false,
            dark: theme === 'dark',
          }}
          onLoad={() => {
            setReady(true)
            skipDirtyRef.current = false
          }}
          onAutoSave={(data) => {
            latestXmlRef.current = data.xml
            if (skipDirtyRef.current) return
            markDirty(true)
          }}
        />
      </div>
    </div>
  )
}
