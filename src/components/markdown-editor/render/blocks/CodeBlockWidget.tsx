import { useCallback, useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { useAppStore } from '@/stores/app-store'
import type { MarkdownThemeConfig } from '../../theme/markdown-theme'

interface CodeBlockWidgetProps {
  source: string
  language: string
  theme: MarkdownThemeConfig
  onSourceChange: (source: string) => void
}

function parseFence(source: string): { lang: string; body: string } {
  const match = source.match(/^```([\w-]*)\n?([\s\S]*?)\n?```$/i)
  if (!match) return { lang: '', body: source }
  return { lang: match[1] ?? '', body: match[2] ?? '' }
}

async function loadLanguageExtension(lang: string): Promise<Extension[]> {
  const normalized = lang.toLowerCase()
  if (!normalized) return []
  const found = languages.find(
    (l) =>
      l.name.toLowerCase() === normalized ||
      l.alias?.some((a) => a.toLowerCase() === normalized),
  )
  if (!found?.load) return []
  try {
    const ext = await found.load()
    return Array.isArray(ext) ? ext : [ext]
  } catch {
    return []
  }
}

const lightEditorTheme = EditorView.theme({
  '&': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
  '.cm-gutters': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
})

export function CodeBlockWidget({
  source,
  language,
  theme,
  onSourceChange,
}: CodeBlockWidgetProps) {
  const appDark = useAppStore((s) => s.settings?.theme === 'dark')
  const useDark = theme.codeMirrorVariant === 'dark' || appDark
  const [editing, setEditing] = useState(false)
  const parsed = useMemo(() => parseFence(source), [source])
  const lang = language || parsed.lang
  const [draft, setDraft] = useState(parsed.body)
  const [langExtensions, setLangExtensions] = useState<Extension[]>([])

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    void loadLanguageExtension(lang).then((ext) => {
      if (!cancelled) setLangExtensions(ext)
    })
    return () => {
      cancelled = true
    }
  }, [lang, editing])

  const commit = useCallback(() => {
    const fenceLang = lang || ''
    const next = `\`\`\`${fenceLang}\n${draft.replace(/\n$/, '')}\n\`\`\``
    onSourceChange(next)
    setEditing(false)
  }, [draft, lang, onSourceChange])

  if (!editing) {
    return (
      <div
        className="markdown-md-block"
        data-block-kind="code"
        data-md-source={source}
        data-language={lang}
        contentEditable={false}
        onDblClick={() => {
          setDraft(parsed.body)
          setEditing(true)
        }}
      >
        <div className="markdown-md-block-header">
          <span>{lang || 'code'}</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => {
              setDraft(parsed.body)
              setEditing(true)
            }}
          >
            Edit
          </button>
        </div>
        <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">
          <code>{parsed.body}</code>
        </pre>
      </div>
    )
  }

  const cmTheme = useDark ? oneDark : lightEditorTheme

  return (
    <div
      className="markdown-md-block"
      data-block-kind="code"
      data-md-source={source}
      data-language={lang}
      contentEditable={false}
    >
      <div className="markdown-md-block-header">
        <span>{lang || 'code'}</span>
        <button type="button" className="text-xs underline" onClick={commit}>
          Done
        </button>
      </div>
      <CodeMirror
        value={draft}
        height="auto"
        minHeight="120px"
        theme={cmTheme}
        extensions={[EditorView.lineWrapping, ...langExtensions]}
        onChange={setDraft}
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  )
}
