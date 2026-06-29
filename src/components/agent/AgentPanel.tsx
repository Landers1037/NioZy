import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, FolderOpen, GitBranch, Loader2, RefreshCcw, Send, Sparkles, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { markdownToHtml } from '@/components/markdown-editor/render/markdown-pipeline'
import { useAgentStore } from '@/stores/agent-store'
import { useAppStore, type AppTab } from '@/stores/app-store'
import type { AgentFileSearchResult, AgentReferencedFile } from '../../../electron/shared/agent-types'
import '@/components/markdown-editor/theme/markdown-theme.css'

const MODE_OPTIONS = ['plan', 'build'] as const

interface AgentPanelProps {
  tab: AppTab
}

function AgentMarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content])

  return (
    <div className="agent-markdown-surface markdown-prose-root">
      <div className="markdown-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function basenameFromPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? path
}

function findActiveFileMention(text: string, caretIndex: number): { query: string; start: number; end: number } | null {
  const uptoCaret = text.slice(0, caretIndex)
  const match = /(?:^|\s)@([^\s@]*)$/.exec(uptoCaret)
  if (!match || match.index < 0) return null
  const atIndex = match.index + match[0].lastIndexOf('@')
  return {
    query: match[1] ?? '',
    start: atIndex,
    end: caretIndex,
  }
}

function buildReferencedFile(file: AgentFileSearchResult): AgentReferencedFile {
  return {
    path: file.path,
    relativePath: file.relativePath,
  }
}

export function AgentPanel({ tab }: AgentPanelProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const {
    selectedDir,
    gitBranch,
    model,
    mode,
    messages,
    connectionState,
    initialized,
    bootstrap,
    ensureRuntime,
    pickDirectory,
    searchFiles,
    setModel,
    setMode,
    sendMessage,
    stopMessage,
    resetSession,
  } = useAgentStore()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [referencedFiles, setReferencedFiles] = useState<AgentReferencedFile[]>([])
  const [fileResults, setFileResults] = useState<AgentFileSearchResult[]>([])
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const safeMessages = messages.filter(
    (message): message is (typeof messages)[number] =>
      Boolean(message) &&
      typeof message.id === 'string' &&
      typeof message.role === 'string' &&
      typeof message.content === 'string' &&
      typeof message.createdAt === 'string',
  )
  const hasStreamingMessage = safeMessages.some((message) => message.streaming === true)
  const inputLocked = sending || hasStreamingMessage
  const lastMessage = safeMessages.at(-1)
  const mentionOpen = mentionRange !== null && fileResults.length > 0

  useEffect(() => {
    void bootstrap()
  }, [bootstrap, tab.id])

  useEffect(() => {
    if (!initialized) return
    if (connectionState === 'ready' || connectionState === 'starting') return
    void ensureRuntime()
  }, [connectionState, ensureRuntime, initialized])

  useEffect(() => {
    const node = messagesEndRef.current
    if (!node) return
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ block: 'end' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [lastMessage?.id, lastMessage?.content, lastMessage?.streaming, hasStreamingMessage])

  useEffect(() => {
    if (!mentionOpen) return
    const activeNode = resultItemRefs.current[activeResultIndex]
    if (!activeNode) return
    activeNode.scrollIntoView({ block: 'nearest' })
  }, [activeResultIndex, mentionOpen])

  const modelOptions = useMemo(() => {
    const provider = settings?.experimental.aiProvider ?? 'openai'
    const models = settings
      ? (
          provider === 'openai'
            ? ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini']
            : provider === 'anthropic'
              ? ['claude-sonnet-4-5', 'claude-3-5-haiku', 'claude-opus-4']
              : provider === 'deepseek'
                ? ['deepseek-chat', 'deepseek-reasoner']
                : provider === 'ollama'
                  ? ['llama3.2', 'qwen2.5', 'mistral', 'deepseek-r1']
                  : ['gpt-4o', 'gpt-4o-mini', 'qwen-plus', 'qwen-max', 'deepseek-chat']
        )
      : []
    return model && !models.includes(model) ? [model, ...models] : models
  }, [model, settings])

  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case 'starting':
        return t('agent.connection.starting')
      case 'ready':
        return t('agent.connection.ready')
      case 'error':
        return t('agent.connection.error')
      default:
        return t('agent.connection.idle')
    }
  }, [connectionState, t])

  const handleSubmit = async () => {
    if (!draft.trim()) return
    setSending(true)
    try {
      await sendMessage(draft, referencedFiles)
      setDraft('')
      setReferencedFiles([])
      setFileResults([])
      setMentionRange(null)
      setActiveResultIndex(0)
    } finally {
      setSending(false)
    }
  }

  const handleStop = async () => {
    if (!hasStreamingMessage) return
    setStopping(true)
    try {
      await stopMessage()
    } finally {
      setStopping(false)
    }
  }

  const updateMentionState = async (nextDraft: string, caretIndex: number) => {
    const mention = findActiveFileMention(nextDraft, caretIndex)
    if (!mention || !selectedDir) {
      setMentionRange(null)
      setFileResults([])
      setActiveResultIndex(0)
      return
    }
    setMentionRange({ start: mention.start, end: mention.end })
    const results = await searchFiles(mention.query)
    const filtered = results.filter(
      (file) => !referencedFiles.some((item) => item.path === file.path),
    )
    resultItemRefs.current = []
    setFileResults(filtered)
    setActiveResultIndex(0)
  }

  const handleDraftChange = (value: string, caretIndex: number) => {
    setDraft(value)
    void updateMentionState(value, caretIndex)
  }

  const insertReferencedFile = (file: AgentFileSearchResult) => {
    const range = mentionRange
    const textarea = textareaRef.current
    if (!range) return
    const before = draft.slice(0, range.start)
    const after = draft.slice(range.end)
    const needsSpacer = before.length > 0 && !/\s$/.test(before) && after.length > 0 && !/^\s/.test(after)
    const nextDraft = `${before}${needsSpacer ? ' ' : ''}${after}`.replace(/\s{3,}/g, '  ')
    const nextCursor = before.length + (needsSpacer ? 1 : 0)
    setDraft(nextDraft)
    setReferencedFiles((current) =>
      current.some((item) => item.path === file.path)
        ? current
        : [...current, buildReferencedFile(file)],
    )
    setMentionRange(null)
    setFileResults([])
    resultItemRefs.current = []
    setActiveResultIndex(0)
    window.requestAnimationFrame(() => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const removeReferencedFile = (path: string) => {
    setReferencedFiles((current) => current.filter((item) => item.path !== path))
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t('agent.title')}</CardTitle>
          <CardDescription>{t('agent.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void pickDirectory()}>
            <FolderOpen data-icon="inline-start" />
            {selectedDir ? basenameFromPath(selectedDir) : t('agent.pickDirectory')}
          </Button>
          {gitBranch ? (
            <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
              <GitBranch className="size-4" />
              {gitBranch}
            </div>
          ) : null}
          <Select value={model || undefined} onValueChange={(value) => void setModel(value)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t('agent.modelPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(value) => void setMode(value as 'plan' | 'build')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`agent.modes.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={() => void ensureRuntime()}>
            {connectionState === 'starting' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {connectionLabel}
          </Button>
          <Button variant="ghost" onClick={() => void resetSession()}>
            <RefreshCcw className="size-4" />
            {t('agent.reset')}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1">
        <CardContent className="flex h-full min-h-0 flex-col gap-4 p-4">
          <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border bg-muted/30">
            <div className="flex min-h-full flex-col gap-3 p-4">
              {!initialized || safeMessages.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                  <Sparkles className="size-8 text-primary" />
                  <div>{t('agent.emptyTitle')}</div>
                  <div>{t('agent.emptyDescription')}</div>
                </div>
              ) : null}
              {safeMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : message.role === 'error'
                        ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                        : 'bg-background text-foreground',
                  )}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-wide opacity-60">
                    {t(`agent.roles.${message.role}`)}
                  </div>
                  {message.referencedFiles && message.referencedFiles.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {message.referencedFiles.map((file) => (
                        <span
                          key={file.path}
                          className="inline-flex items-center gap-1 rounded-full border border-current/15 px-2 py-1 text-[11px] opacity-80"
                        >
                          <FileText className="size-3" />
                          {file.relativePath}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.role === 'user' || message.role === 'error' ? (
                    <div className="whitespace-pre-wrap break-words">
                      {message.content || (message.streaming ? '…' : '')}
                    </div>
                  ) : (
                    <AgentMarkdownContent content={message.content || (message.streaming ? '…' : '')} />
                  )}
                </div>
              ))}
              {hasStreamingMessage ? (
                <div className="max-w-[85%] px-1 py-2 text-sm">
                  <span className="agent-thinking-shiny">Thinking</span>
                </div>
              ) : null}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3">
            {referencedFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {referencedFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 text-xs text-foreground transition hover:bg-muted"
                    onClick={() => removeReferencedFile(file.path)}
                    title={t('agent.removeReferencedFile')}
                  >
                    <FileText className="size-3" />
                    <span className="max-w-[280px] truncate">{file.relativePath}</span>
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
              placeholder={t('agent.inputPlaceholder')}
              className="min-h-28 bg-transparent"
              disabled={inputLocked}
              onKeyDown={(e) => {
                if (inputLocked) return
                if (mentionOpen) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveResultIndex((current) => (current + 1) % fileResults.length)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveResultIndex((current) => (current - 1 + fileResults.length) % fileResults.length)
                    return
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const selected = fileResults[activeResultIndex]
                    if (selected) insertReferencedFile(selected)
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setMentionRange(null)
                    setFileResults([])
                    resultItemRefs.current = []
                    setActiveResultIndex(0)
                    return
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
              onClick={(e) => {
                const target = e.currentTarget
                void updateMentionState(target.value, target.selectionStart ?? target.value.length)
              }}
              onKeyUp={(e) => {
                if (
                  mentionOpen &&
                  (e.key === 'ArrowDown' ||
                    e.key === 'ArrowUp' ||
                    e.key === 'Enter' ||
                    e.key === 'Escape')
                ) {
                  return
                }
                const target = e.currentTarget
                void updateMentionState(target.value, target.selectionStart ?? target.value.length)
              }}
            />
            {mentionRange ? (
              <div className="rounded-xl border border-border bg-popover p-1 shadow-sm">
                {fileResults.length > 0 ? (
                  <div className="show-scrollbar max-h-56 overflow-y-auto overscroll-contain px-1 pr-2">
                    <div className="flex flex-col gap-1">
                      {fileResults.map((file, index) => (
                        <button
                          key={file.path}
                          type="button"
                          ref={(node) => {
                            resultItemRefs.current[index] = node
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                            index === activeResultIndex
                              ? 'scale-[1.01] border-primary/30 bg-muted shadow-sm'
                              : 'border-transparent hover:scale-[1.005] hover:border-border hover:bg-muted/70',
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            insertReferencedFile(file)
                          }}
                          onMouseEnter={() => setActiveResultIndex(index)}
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{file.relativePath}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t('agent.noMatchingFiles')}
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {t('agent.contextSummary', {
                  mode: t(`agent.modes.${mode}`),
                  model: model || '-',
                  dir: selectedDir || t('agent.noDirectory'),
                })}
              </div>
              {hasStreamingMessage ? (
                <Button variant="secondary" onClick={() => void handleStop()} disabled={stopping}>
                  {stopping ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4 fill-current" />}
                  {t('agent.running')}
                </Button>
              ) : (
                <Button onClick={() => void handleSubmit()} disabled={inputLocked || !draft.trim()}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {t('agent.send')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
