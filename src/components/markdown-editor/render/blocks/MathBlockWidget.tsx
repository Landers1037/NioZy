import { useCallback, useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'

interface MathBlockWidgetProps {
  source: string
  inline?: boolean
  onSourceChange: (source: string) => void
}

function parseMathSource(source: string, inline: boolean): string {
  if (inline) {
    const m = source.match(/^\$([\s\S]+?)\$$/)
    return m?.[1]?.trim() ?? source.replace(/^\$|\$$/g, '').trim()
  }
  const m = source.match(/^\$\$([\s\S]+?)\$\$/m)
  return m?.[1]?.trim() ?? source.replace(/^\$\$|\$\$/g, '').trim()
}

function wrapMathSource(tex: string, inline: boolean): string {
  const body = tex.trim()
  return inline ? `$${body}$` : `$$\n${body}\n$$`
}

export function MathBlockWidget({ source, inline = false, onSourceChange }: MathBlockWidgetProps) {
  const [editing, setEditing] = useState(false)
  const tex = useMemo(() => parseMathSource(source, inline), [source, inline])
  const [draft, setDraft] = useState(tex)

  const rendered = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: !inline,
        throwOnError: false,
        strict: 'ignore',
      })
    } catch {
      return `<span class="text-destructive">${tex}</span>`
    }
  }, [inline, tex])

  useEffect(() => {
    if (!editing) setDraft(tex)
  }, [editing, tex])

  const commit = useCallback(() => {
    onSourceChange(wrapMathSource(draft, inline))
    setEditing(false)
  }, [draft, inline, onSourceChange])

  if (editing) {
    return (
      <div
        className={cn('markdown-md-block', inline && 'inline-block')}
        data-block-kind={inline ? 'math-inline' : 'math-block'}
        data-md-source={source}
        contentEditable={false}
      >
        <div className="markdown-md-block-header">
          <span>{inline ? 'Math' : 'Math Block'}</span>
          <button type="button" className="text-xs underline" onClick={commit}>
            Done
          </button>
        </div>
        <textarea
          className="min-h-[80px] w-full resize-y bg-transparent p-3 font-mono text-xs outline-none"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'markdown-md-block',
        inline ? 'inline-block align-middle' : 'block',
      )}
      data-block-kind={inline ? 'math-inline' : 'math-block'}
      data-md-source={source}
      contentEditable={false}
      onDblClick={() => {
        setDraft(tex)
        setEditing(true)
      }}
    >
      {!inline && (
        <div className="markdown-md-block-header">
          <span>Math</span>
          <button
            type="button"
            className="text-xs underline"
            onClick={() => {
              setDraft(tex)
              setEditing(true)
            }}
          >
            Edit
          </button>
        </div>
      )}
      <div
        className={cn(!inline && 'p-3')}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  )
}
