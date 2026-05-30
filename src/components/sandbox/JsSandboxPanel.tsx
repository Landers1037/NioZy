import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { jsSandboxClient } from '@/lib/js-sandbox-client'
import {
  JS_SANDBOX_MAX_UI_LINES,
  type JsSandboxOutputLine,
  type JsSandboxWorkerEvent,
} from '@/lib/js-sandbox-types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

const INPUT_HISTORY_MAX = 50

function nextLineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function appendLines(
  prev: JsSandboxOutputLine[],
  lines: JsSandboxOutputLine[],
): JsSandboxOutputLine[] {
  const merged = [...prev, ...lines]
  if (merged.length <= JS_SANDBOX_MAX_UI_LINES) return merged
  return merged.slice(merged.length - JS_SANDBOX_MAX_UI_LINES)
}

export function JsSandboxPanel() {
  const { t } = useTranslation()
  const fontFamily = useAppStore((s) => s.settings?.terminal.fontFamily)
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<JsSandboxOutputLine[]>([])
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const requestCounter = useRef(0)

  useEffect(() => {
    let cancelled = false
    void jsSandboxClient
      .init()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setLines([
            {
              id: nextLineId(),
              kind: 'error',
              text: err instanceof Error ? err.message : String(err),
            },
          ])
        }
      })
    return () => {
      cancelled = true
      jsSandboxClient.dispose()
    }
  }, [])

  useEffect(() => {
    console.log('[sandbox-panel] lines state updated, count=', lines.length, lines.map((l) => l.kind + ':' + l.text).join(' | '))
    const el = outputRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines, running])

  const runCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed || running) return

      setRunning(true)
      setHistory((prev) => {
        const next = prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]
        return next.slice(-INPUT_HISTORY_MAX)
      })
      setHistoryIndex(-1)

      const requestId = `req-${++requestCounter.current}`
      const inputLine: JsSandboxOutputLine = {
        id: nextLineId(),
        kind: 'input',
        text: trimmed,
      }
      setLines((prev) => appendLines(prev, [inputLine]))

      const pending: JsSandboxOutputLine[] = []

      const flushPending = () => {
        console.log('[sandbox-panel] flushPending, pending.length=', pending.length)
        if (pending.length === 0) return
        const snapshot = [...pending]
        setLines((prev) => {
          console.log('[sandbox-panel] setLines updater, prev.length=', prev.length, 'adding=', snapshot.map((l) => l.kind + ':' + l.text).join(' | '))
          return appendLines(prev, snapshot)
        })
        pending.length = 0
      }

      const onEvent = (event: JsSandboxWorkerEvent) => {
        console.log('[sandbox-panel] onEvent called, type=', event.type, JSON.stringify(event))
        if (event.type === 'ready') return
        if (!('requestId' in event) || event.requestId !== requestId) {
          console.log('[sandbox-panel] requestId mismatch, skipping', 'event.requestId=' + ('requestId' in event ? event.requestId : 'none'), 'expected=', requestId)
          return
        }
        if (event.type === 'log') {
          pending.push({
            id: nextLineId(),
            kind: 'log',
            level: event.level,
            text: event.message,
          })
        } else if (event.type === 'result') {
          console.log('[sandbox-panel] got result:', event.message)
          pending.push({
            id: nextLineId(),
            kind: 'result',
            text: event.message,
          })
        } else if (event.type === 'error') {
          pending.push({
            id: nextLineId(),
            kind: 'error',
            text: event.message,
          })
        }
        flushPending()
      }

      try {
        await jsSandboxClient.eval(trimmed, requestId, onEvent)
        flushPending()
      } catch (err) {
        setLines((prev) =>
          appendLines(prev, [
            {
              id: nextLineId(),
              kind: 'error',
              text: err instanceof Error ? err.message : String(err),
            },
          ]),
        )
      } finally {
        setRunning(false)
        setInput('')
        textareaRef.current?.focus()
      }
    },
    [running],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void runCode(input)
      return
    }
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault()
      const nextIndex =
        historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(history[nextIndex] ?? '')
      return
    }
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault()
      const nextIndex = historyIndex + 1
      if (nextIndex >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(nextIndex)
        setInput(history[nextIndex] ?? '')
      }
    }
  }

  const monoStyle = fontFamily ? { fontFamily } : undefined

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Braces className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{t('sandbox.title')}</span>
          {!ready && (
            <span className="text-xs text-muted-foreground">{t('sandbox.loadingRuntime')}</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={lines.length === 0}
          onClick={() => setLines([])}
        >
          <Trash2 className="size-3.5" />
          {t('sandbox.clear')}
        </Button>
      </div>

      <div
        ref={outputRef}
        className="min-h-0 flex-1 overflow-y-auto bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 dark:bg-zinc-950"
        style={monoStyle}
      >
        {lines.length === 0 && (
          <p className="text-muted-foreground">{t('sandbox.emptyHint')}</p>
        )}
        {lines.map((line) => {
          if (line.kind === 'input') {
            return (
              <div key={line.id} className="mt-1 flex gap-2">
                <span className="shrink-0 select-none text-zinc-500">&gt;</span>
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words text-zinc-400">
                  {line.text}
                </pre>
              </div>
            )
          }
          if (line.kind === 'log') {
            return (
              <pre
                key={line.id}
                className={cn(
                  'mt-0.5 whitespace-pre-wrap break-words',
                  line.level === 'warn' && 'text-amber-300',
                  line.level === 'error' && 'text-red-400',
                  line.level === 'log' && 'text-zinc-200',
                )}
              >
                {line.text}
              </pre>
            )
          }
          if (line.kind === 'result') {
            return (
              <pre
                key={line.id}
                className="mt-0.5 whitespace-pre-wrap break-words text-sky-300"
              >
                <span className="select-none text-zinc-500">= </span>
                {line.text}
              </pre>
            )
          }
          return (
            <pre
              key={line.id}
              className="mt-0.5 whitespace-pre-wrap break-words text-red-400"
            >
              {line.text}
            </pre>
          )
        })}
        {running && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t('sandbox.running')}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!ready || running}
            rows={3}
            spellCheck={false}
            placeholder={t('sandbox.inputPlaceholder')}
            className="min-h-[72px] flex-1 resize-y rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            style={monoStyle}
          />
          <Button
            type="button"
            className="shrink-0 self-end"
            disabled={!ready || running || !input.trim()}
            onClick={() => void runCode(input)}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : t('sandbox.run')}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t('sandbox.inputHint')}</p>
      </div>
    </div>
  )
}
