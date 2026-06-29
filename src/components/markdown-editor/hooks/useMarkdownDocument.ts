import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getElectronAPI } from '@/lib/electron-client'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'
import {
  defaultFileNameFromPath,
  DEFAULT_MARKDOWN_FILE_NAME,
} from '@/components/markdown-editor/lib/markdown-file'

export function useMarkdownDocument(tabId: string, filePath: string | undefined) {
  const { t } = useTranslation()
  const session = useMarkdownEditorStore((s) => s.sessions[tabId])
  const ensureSession = useMarkdownEditorStore((s) => s.ensureSession)
  const setContent = useMarkdownEditorStore((s) => s.setContent)
  const setLoading = useMarkdownEditorStore((s) => s.setLoading)
  const setLoadError = useMarkdownEditorStore((s) => s.setLoadError)

  useEffect(() => {
    ensureSession(tabId)
  }, [ensureSession, tabId])

  useEffect(() => {
    if (!filePath) return
    const existing = useMarkdownEditorStore.getState().sessions[tabId]
    if (existing?.dirty) return
    if (existing && !existing.loading && existing.content.length > 0) return
    let cancelled = false
    setLoading(tabId, true)
    setLoadError(tabId, null)
    void getElectronAPI()
      .markdown.readFile(filePath)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          if (result.error === 'FILE_TOO_LARGE') {
            setLoadError(tabId, t('markdownEditor.fileTooLarge'))
            toast.error(t('markdownEditor.fileTooLarge'))
          } else {
            setLoadError(tabId, t('markdownEditor.openFailed'))
            toast.error(t('markdownEditor.openFailed'))
          }
          return
        }
        setContent(tabId, result.content, { dirty: false, persistedContent: result.content })
      })
      .finally(() => {
        if (!cancelled) setLoading(tabId, false)
      })
    return () => {
      cancelled = true
    }
  }, [filePath, setContent, setLoadError, setLoading, t, tabId])

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(tabId, next)
    },
    [setContent, tabId],
  )

  const save = useCallback(
    async (saveAs = false) => {
      const current = useMarkdownEditorStore.getState().sessions[tabId]
      const content = current?.content ?? ''
      const result = await getElectronAPI().markdown.saveFile({
        content,
        defaultFileName: defaultFileNameFromPath(filePath),
        filePath: saveAs ? undefined : filePath,
      })
      if (!result.ok) {
        if ('canceled' in result && result.canceled) return null
        toast.error(t('markdownEditor.saveFailed'))
        return null
      }
      setContent(tabId, content, { dirty: false, persistedContent: content })
      toast.success(t('markdownEditor.saveSuccess'))
      return result.path
    },
    [filePath, setContent, t, tabId],
  )

  const openFromDialog = useCallback(async () => {
    const result = await getElectronAPI().markdown.openFile()
    if (!result.ok) {
      if ('canceled' in result && result.canceled) return null
      if ('error' in result && result.error === 'FILE_TOO_LARGE') {
        toast.error(t('markdownEditor.fileTooLarge'))
      } else {
        toast.error(t('markdownEditor.openFailed'))
      }
      return null
    }
    return result
  }, [t])

  const newDocument = useCallback(() => {
    setContent(tabId, `# ${t('markdownEditor.untitled')}\n\n`, { dirty: true })
    setLoadError(tabId, null)
  }, [setContent, setLoadError, t, tabId])

  return {
    content: session?.content ?? '',
    dirty: session?.dirty ?? false,
    loading: session?.loading ?? false,
    loadError: session?.loadError ?? null,
    handleContentChange,
    save,
    openFromDialog,
    newDocument,
    defaultFileName: filePath ? defaultFileNameFromPath(filePath) : DEFAULT_MARKDOWN_FILE_NAME,
  }
}
