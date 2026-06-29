import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  markdownToHtml,
  resolveMarkdownHtmlImageSources,
} from '../render/markdown-pipeline'
import { CodeBlockWidget } from '../render/blocks/CodeBlockWidget'
import { MermaidBlockWidget } from '../render/blocks/MermaidBlockWidget'
import { MathBlockWidget } from '../render/blocks/MathBlockWidget'
import type { MarkdownThemeConfig } from '../theme/markdown-theme'
import { cn } from '@/lib/utils'
import { FilesystemImagePreviewDialog } from '@/components/filesystem/FilesystemImagePreviewDialog'

import { splitMarkdownBlocks } from '../lib/markdown-blocks'

interface WysiwygModeEditorProps {
  value: string
  onChange: (value: string) => void
  theme: MarkdownThemeConfig
  className?: string
  registerFlush?: (flush: () => void) => void
  markdownFilePath?: string
}

interface HtmlSegmentWidgetProps {
  source: string
  markdownFilePath?: string
  onSourceChange: (source: string) => void
}

function HtmlSegmentWidget({
  source,
  markdownFilePath,
  onSourceChange,
}: HtmlSegmentWidgetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(source)

  useEffect(() => {
    if (!editing) setDraft(source)
  }, [editing, source])

  useEffect(() => {
    const root = rootRef.current
    if (!root || editing) return
    void resolveMarkdownHtmlImageSources(root, markdownFilePath)
  }, [editing, markdownFilePath, source])

  useEffect(() => {
    const root = rootRef.current
    if (!root || editing) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLImageElement)) return
      const resolved = target.getAttribute('data-md-resolved-path')
      if (!resolved) return
      event.preventDefault()
      const fileName = resolved.split(/[/\\]/).pop() ?? resolved
      const openEvent = new CustomEvent('markdown-image-preview', {
        detail: { path: resolved, name: fileName },
      })
      root.dispatchEvent(openEvent)
    }

    root.addEventListener('click', handleClick)
    return () => root.removeEventListener('click', handleClick)
  }, [editing])

  const commit = useCallback(() => {
    const next = draft.replace(/\r\n/g, '\n')
    setEditing(false)
    if (next !== source) onSourceChange(next)
  }, [draft, onSourceChange, source])

  if (editing) {
    return (
      <div className="markdown-html-segment-editing">
        <textarea
          className="markdown-html-segment-textarea"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
        />
      </div>
    )
  }

  const html = markdownToHtml(source)
  return (
    <div
      ref={rootRef}
      className="markdown-html-segment"
      dangerouslySetInnerHTML={{ __html: html }}
      onDoubleClick={() => setEditing(true)}
    />
  )
}

export function WysiwygModeEditor({
  value,
  onChange,
  theme,
  className,
  registerFlush,
  markdownFilePath,
}: WysiwygModeEditorProps) {
  const blockSourcesRef = useRef<Map<number, string>>(new Map())
  const proseRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  onChangeRef.current = onChange

  const segments = useMemo(() => splitMarkdownBlocks(value), [value])

  useEffect(() => {
    registerFlush?.(() => {})
    return () => registerFlush?.(() => {})
  }, [registerFlush])

  const handleBlockChange = useCallback(
    (index: number, nextSource: string) => {
      blockSourcesRef.current.set(index, nextSource)
      const rebuilt = segments.map((seg, i) =>
        i === index ? nextSource : blockSourcesRef.current.get(i) ?? seg.content,
      )
      onChangeRef.current(rebuilt.join(''))
    },
    [segments],
  )

  useEffect(() => {
    const root = proseRef.current
    if (!root) return

    const handlePreviewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string; name: string }>
      setPreviewPath(customEvent.detail.path)
      setPreviewName(customEvent.detail.name)
    }

    root.addEventListener('markdown-image-preview', handlePreviewEvent as EventListener)
    return () =>
      root.removeEventListener('markdown-image-preview', handlePreviewEvent as EventListener)
  }, [])

  return (
    <>
      <div className={cn('markdown-prose-root markdown-editor-scroll show-scrollbar h-full min-h-0', className)}>
        <div ref={proseRef} className="markdown-prose">
          {segments.map((seg, index) => {
            if (seg.kind === 'mermaid') {
              return (
                <MermaidBlockWidget
                  key={`mermaid-${index}`}
                  source={seg.content}
                  theme={theme}
                  onSourceChange={(next) => handleBlockChange(index, next)}
                />
              )
            }
            if (seg.kind === 'math') {
              return (
                <MathBlockWidget
                  key={`math-${index}`}
                  source={seg.content}
                  onSourceChange={(next) => handleBlockChange(index, next)}
                />
              )
            }
            if (seg.kind === 'code') {
              return (
                <CodeBlockWidget
                  key={`code-${index}`}
                  source={seg.content}
                  language={seg.language ?? ''}
                  theme={theme}
                  onSourceChange={(next) => handleBlockChange(index, next)}
                />
              )
            }
            return (
              <HtmlSegmentWidget
                key={`html-${index}`}
                source={seg.content}
                markdownFilePath={markdownFilePath}
                onSourceChange={(next) => handleBlockChange(index, next)}
              />
            )
          })}
        </div>
      </div>
      <FilesystemImagePreviewDialog
        filePath={previewPath}
        fileName={previewName}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPath(null)
            setPreviewName('')
          }
        }}
      />
    </>
  )
}
