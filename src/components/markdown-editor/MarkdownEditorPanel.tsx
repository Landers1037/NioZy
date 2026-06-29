import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useMarkdownEditorStore } from '@/stores/markdown-editor-store'
import { useMarkdownModeSync } from './hooks/useMarkdownModeSync'
import { useMarkdownDocument } from './hooks/useMarkdownDocument'
import { MarkdownEditorChrome } from './MarkdownEditorChrome'
import { MarkdownEditorSurface } from './MarkdownEditorSurface'
import {
  applyMarkdownTheme,
  resolveMarkdownThemeForApp,
} from './theme/markdown-theme'
import { defaultFileNameFromPath } from './lib/markdown-file'
import { openMarkdownTabWithContent } from '@/lib/markdown-tab-actions'
import type { AppTab } from '@/stores/app-store'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import 'katex/dist/katex.min.css'
import './theme/markdown-theme.css'

interface MarkdownEditorPanelProps {
  tab: AppTab
}

export function MarkdownEditorPanel({ tab }: MarkdownEditorPanelProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const appTheme = useAppStore((s) => s.settings?.theme)
  const accentColor = useAppStore((s) => s.settings?.accentColor)
  const ensureSession = useMarkdownEditorStore((s) => s.ensureSession)

  const { isWysiwyg, setWysiwyg } = useMarkdownModeSync(tab.id)
  const doc = useMarkdownDocument(tab.id, tab.markdownFilePath)

  useEffect(() => {
    ensureSession(tab.id)
  }, [ensureSession, tab.id])

  const theme = useMemo(
    () => resolveMarkdownThemeForApp(undefined, appTheme, accentColor),
    [appTheme, accentColor],
  )

  useEffect(() => {
    if (!rootRef.current) return
    applyMarkdownTheme(rootRef.current, theme)
  }, [theme])

  const fileName = defaultFileNameFromPath(tab.markdownFilePath)

  const handleOpen = async () => {
    const result = await doc.openFromDialog()
    if (!result) return
    openMarkdownTabWithContent(result.path, result.content)
  }

  const handleSave = async () => {
    const path = await doc.save(false)
    if (path && path !== tab.markdownFilePath) {
      useAppStore.getState().patchMarkdownTab(tab.id, { markdownFilePath: path })
    }
  }

  const handleSaveAs = async () => {
    const path = await doc.save(true)
    if (path) {
      useAppStore.getState().patchMarkdownTab(tab.id, {
        markdownFilePath: path,
        title: path.split(/[/\\]/).pop() ?? path,
      })
    }
  }

  const handleNew = () => {
    doc.newDocument()
    useAppStore.getState().patchMarkdownTab(tab.id, {
      markdownFilePath: undefined,
      title: t('markdownEditor.untitled'),
    })
  }

  return (
    <div ref={rootRef} className="markdown-prose-root relative flex h-full min-h-0 flex-col">
      <MarkdownEditorChrome
        isWysiwyg={isWysiwyg}
        onWysiwygChange={setWysiwyg}
        dirty={doc.dirty}
        fileName={fileName}
        content={doc.content}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
        disabled={doc.loading}
      />

      {doc.loading ? (
        <div className="markdown-editor-loading flex-1 gap-2">
          <Loader2 className="size-5 animate-spin" />
          {t('markdownEditor.loading')}
        </div>
      ) : doc.loadError ? (
        <div className="markdown-editor-loading flex-1 text-destructive">{doc.loadError}</div>
      ) : (
        <MarkdownEditorSurface
          tabId={tab.id}
          content={doc.content}
          onChange={doc.handleContentChange}
          theme={theme}
          markdownFilePath={tab.markdownFilePath}
          className="flex-1"
        />
      )}
    </div>
  )
}
