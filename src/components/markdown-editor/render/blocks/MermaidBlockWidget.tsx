import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { cn } from '@/lib/utils'
import type { MarkdownThemeConfig } from '../../theme/markdown-theme'

interface MermaidBlockWidgetProps {
  source: string
  theme: MarkdownThemeConfig
  onSourceChange: (source: string) => void
}

let mermaidInitialized = false

function ensureMermaid(theme: MarkdownThemeConfig) {
  if (mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: theme.mermaidTheme ?? 'neutral' })
    return
  }
  mermaid.initialize({ startOnLoad: false, theme: theme.mermaidTheme ?? 'neutral' })
  mermaidInitialized = true
}

export function MermaidBlockWidget({ source, theme, onSourceChange }: MermaidBlockWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const innerSource = source
    .replace(/^```mermaid\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()

  useEffect(() => {
    if (editing || !containerRef.current) return
    ensureMermaid(theme)
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    let cancelled = false
    void mermaid.render(id, innerSource).then(({ svg }) => {
      if (cancelled || !containerRef.current) return
      containerRef.current.innerHTML = svg
      setError(null)
    }).catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      cancelled = true
    }
  }, [innerSource, editing, theme])

  const startEdit = useCallback(() => {
    setDraft(innerSource)
    setEditing(true)
  }, [innerSource])

  const commitEdit = useCallback(() => {
    const next = `\`\`\`mermaid\n${draft.trim()}\n\`\`\``
    onSourceChange(next)
    setEditing(false)
  }, [draft, onSourceChange])

  if (editing) {
    return (
      <div
        className="markdown-md-block"
        data-block-kind="mermaid"
        data-md-source={source}
        contentEditable={false}
      >
        <div className="markdown-md-block-header">
          <span>Mermaid</span>
          <button type="button" className="text-xs underline" onClick={commitEdit}>
            Done
          </button>
        </div>
        <textarea
          className="min-h-[120px] w-full resize-y bg-transparent p-3 font-mono text-xs outline-none"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
        />
      </div>
    )
  }

  return (
    <div
      className="markdown-md-block"
      data-block-kind="mermaid"
      data-md-source={source}
      contentEditable={false}
      onDblClick={startEdit}
    >
      <div className="markdown-md-block-header">
        <span>Mermaid</span>
        <button type="button" className="text-xs underline" onClick={startEdit}>
          Edit
        </button>
      </div>
      <div
        ref={containerRef}
        className={cn('markdown-mermaid-block min-h-[80px] p-4', error && 'text-destructive text-xs')}
      >
        {error ?? null}
      </div>
    </div>
  )
}
