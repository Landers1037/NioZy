import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { DIFF_LINE_HEIGHT_PX, diffLineClass, type DiffLine } from '@/lib/diff-parse'
import { parseDiffInWorker } from '@/lib/diff-parse-client'

interface CommitFileDiffViewProps {
  diff: string
  className?: string
}

const OVERSCAN_ROWS = 12

export function CommitFileDiffView({ diff, className }: CommitFileDiffViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<DiffLine[]>([])
  const [parsing, setParsing] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    let cancelled = false
    setParsing(true)
    void parseDiffInWorker(diff).then((parsed) => {
      if (cancelled) return
      setLines(parsed)
      setParsing(false)
    })
    return () => {
      cancelled = true
    }
  }, [diff])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setViewportHeight(el.clientHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [lines.length])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
  }, [])

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const total = lines.length
    if (total === 0 || viewportHeight <= 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0 }
    }
    const start = Math.max(0, Math.floor(scrollTop / DIFF_LINE_HEIGHT_PX) - OVERSCAN_ROWS)
    const visibleCount = Math.ceil(viewportHeight / DIFF_LINE_HEIGHT_PX) + OVERSCAN_ROWS * 2
    const end = Math.min(total, start + visibleCount)
    return { startIndex: start, endIndex: end, offsetY: start * DIFF_LINE_HEIGHT_PX }
  }, [lines.length, scrollTop, viewportHeight])

  const visibleLines = useMemo(
    () => lines.slice(startIndex, endIndex),
    [lines, startIndex, endIndex],
  )

  if (!diff) {
    return null
  }

  if (parsing && lines.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground',
          className,
        )}
      >
        …
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={cn(
        'show-scrollbar min-w-0 w-full max-w-full overflow-auto rounded-md border border-border bg-muted/30',
        className,
      )}
    >
      <div
        className="relative w-max min-w-full font-mono text-[11px] leading-relaxed"
        style={{ height: lines.length * DIFF_LINE_HEIGHT_PX }}
      >
        <div className="absolute left-0 top-0 w-full p-2" style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleLines.map((line, index) => (
            <div
              key={`${startIndex + index}-${line.text.slice(0, 12)}`}
              className={cn('whitespace-pre', diffLineClass(line.kind))}
              style={{ height: DIFF_LINE_HEIGHT_PX }}
            >
              {line.text || ' '}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
