import { useCallback, useEffect, useMemo, useRef } from 'react'
import { markdownToHtml, domToMarkdown } from '../render/markdown-pipeline'
import { CodeBlockWidget } from '../render/blocks/CodeBlockWidget'
import { MermaidBlockWidget } from '../render/blocks/MermaidBlockWidget'
import { MathBlockWidget } from '../render/blocks/MathBlockWidget'
import type { MarkdownThemeConfig } from '../theme/markdown-theme'
import { cn } from '@/lib/utils'

import { splitMarkdownBlocks } from '../lib/markdown-blocks'

interface WysiwygModeEditorProps {
  value: string
  onChange: (value: string) => void
  theme: MarkdownThemeConfig
  className?: string
  registerFlush?: (flush: () => void) => void
}

export function WysiwygModeEditor({
  value,
  onChange,
  theme,
  className,
  registerFlush,
}: WysiwygModeEditorProps) {
  const proseRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockSourcesRef = useRef<Map<number, string>>(new Map())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const segments = useMemo(() => splitMarkdownBlocks(value), [value])

  const syncFromDom = useCallback(() => {
    const root = proseRef.current
    if (!root) return
    const parts: string[] = []
    for (const child of Array.from(root.children)) {
      const mdSource = (child as HTMLElement).getAttribute('data-md-source')
      if (mdSource) {
        parts.push(mdSource)
      } else {
        parts.push(domToMarkdown(child as HTMLElement))
      }
    }
    const next = parts.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
    onChangeRef.current(next)
  }, [])

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      syncFromDom()
    }, 300)
  }, [syncFromDom])

  const flushSync = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    syncFromDom()
  }, [syncFromDom])

  useEffect(() => {
    registerFlush?.(flushSync)
    return () => registerFlush?.(() => {})
  }, [flushSync, registerFlush])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleBlockChange = useCallback(
    (index: number, nextSource: string) => {
      blockSourcesRef.current.set(index, nextSource)
      const rebuilt = segments.map((seg, i) =>
        i === index ? nextSource : blockSourcesRef.current.get(i) ?? seg.content,
      )
      onChangeRef.current(rebuilt.join('\n\n'))
    },
    [segments],
  )

  return (
    <div className={cn('markdown-prose-root markdown-editor-scroll show-scrollbar h-full min-h-0', className)}>
      <div
        ref={proseRef}
        className="markdown-prose"
        onInput={scheduleSync}
        onBlur={syncFromDom}
      >
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
          const html = markdownToHtml(seg.content)
          return (
            <div
              key={`html-${index}`}
              className="markdown-html-segment"
              contentEditable
              // @ts-expect-error Preact compat prop for React parity
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        })}
      </div>
    </div>
  )
}
