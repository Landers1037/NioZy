import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { getTerminal } from '@/lib/terminal-registry'
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'

type MatchPos = { line: number; index: number }

function findNextMatch(lines: string[], query: string, from: MatchPos | null): MatchPos | null {
  if (!query) return null
  const q = query
  const startLine = from ? from.line : 0
  const startIndex = from ? from.index + 1 : 0

  for (let i = startLine; i < lines.length; i++) {
    const s = lines[i] ?? ''
    const idx = i === startLine ? s.indexOf(q, startIndex) : s.indexOf(q)
    if (idx >= 0) return { line: i, index: idx }
  }
  return null
}

function findPrevMatch(lines: string[], query: string, from: MatchPos | null): MatchPos | null {
  if (!query) return null
  const q = query
  const startLine = from ? from.line : lines.length - 1
  const startIndex = from ? from.index - 1 : Number.POSITIVE_INFINITY

  for (let i = startLine; i >= 0; i--) {
    const s = lines[i] ?? ''
    const idx = i === startLine ? s.lastIndexOf(q, Math.max(0, startIndex)) : s.lastIndexOf(q)
    if (idx >= 0) return { line: i, index: idx }
  }
  return null
}

function safeGetBufferLines(term: import('@xterm/xterm').Terminal): string[] {
  const buffer = term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    lines.push(line ? line.translateToString(true) : '')
  }
  return lines
}

export function TerminalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [query, setQuery] = useState('')
  const [match, setMatch] = useState<MatchPos | null>(null)
  const [matchCountHint, setMatchCountHint] = useState<string | null>(null)

  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)

  const activeTerminalId = useMemo(() => {
    const activeTab = tabs.find((x) => x.id === activeTabId)
    if (!activeTab || activeTab.type !== 'terminal') return undefined
    return getActiveTerminalId(activeTab)
  }, [tabs, activeTabId])

  const jumpTo = (pos: MatchPos | null, q: string) => {
    if (!pos || !activeTerminalId || !q) return
    const term = getTerminal(activeTerminalId)
    if (!term) return
    try {
      term.scrollToLine(pos.line)
      // 精确列选择需要 stringIndex ↔ bufferCol 映射（涉及宽字符）；这里先高亮整行，保证可见与定位
      term.select(0, pos.line, Math.max(1, (term.cols ?? 1) - 1))
      term.focus()
    } catch {
      // ignore
    }
  }

  const doSearch = (dir: 'next' | 'prev') => {
    if (!activeTerminalId) return
    const term = getTerminal(activeTerminalId)
    if (!term) return
    const q = query.trim()
    if (!q) return

    const lines = safeGetBufferLines(term)
    const next =
      dir === 'next' ? findNextMatch(lines, q, match) : findPrevMatch(lines, q, match)
    setMatch(next)
    jumpTo(next, q)
    setMatchCountHint(next ? null : t('titleBar.searchNoMatch'))
  }

  useEffect(() => {
    if (!open) return
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    setMatch(null)
    setMatchCountHint(null)
  }, [open, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('titleBar.search')}</DialogTitle>
          <DialogDescription>{t('titleBar.searchHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('titleBar.searchPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                doSearch(e.shiftKey ? 'prev' : 'next')
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onOpenChange(false)
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => doSearch('prev')}
            aria-label={t('titleBar.searchPrev')}
            title={t('titleBar.searchPrev')}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => doSearch('next')}
            aria-label={t('titleBar.searchNext')}
            title={t('titleBar.searchNext')}
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
        {matchCountHint ? (
          <div className="text-xs text-muted-foreground">{matchCountHint}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

