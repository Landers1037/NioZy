import { useEffect, useMemo, useRef } from 'react'
import { SourceModeEditor } from './modes/SourceModeEditor'
import { WysiwygModeEditor } from './modes/WysiwygModeEditor'
import { useMarkdownModeSync } from './hooks/useMarkdownModeSync'
import type { MarkdownThemeConfig } from './theme/markdown-theme'
import { cn } from '@/lib/utils'

interface MarkdownEditorSurfaceProps {
  tabId: string
  content: string
  onChange: (value: string) => void
  theme: MarkdownThemeConfig
  className?: string
}

export function MarkdownEditorSurface({
  tabId,
  content,
  onChange,
  theme,
  className,
}: MarkdownEditorSurfaceProps) {
  const { isWysiwyg, mode } = useMarkdownModeSync(tabId)
  const wysiwygFlushRef = useRef<(() => void) | null>(null)
  const prevModeRef = useRef(mode)

  useEffect(() => {
    if (prevModeRef.current === 'wysiwyg' && mode === 'source') {
      wysiwygFlushRef.current?.()
    }
    prevModeRef.current = mode
  }, [mode])

  const editor = useMemo(() => {
    if (isWysiwyg) {
      return (
        <WysiwygModeEditor
          value={content}
          onChange={onChange}
          theme={theme}
          className="h-full"
          registerFlush={(fn) => {
            wysiwygFlushRef.current = fn
          }}
        />
      )
    }
    return (
      <SourceModeEditor
        value={content}
        onChange={onChange}
        theme={theme}
        className="h-full"
      />
    )
  }, [content, isWysiwyg, onChange, theme])

  return <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>{editor}</div>
}
