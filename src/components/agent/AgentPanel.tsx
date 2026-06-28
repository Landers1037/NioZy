import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, GitBranch, Loader2, RefreshCcw, Send, Sparkles } from 'lucide-react'
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
import { useAgentStore } from '@/stores/agent-store'
import { useAppStore, type AppTab } from '@/stores/app-store'

const MODE_OPTIONS = ['plan', 'build'] as const

interface AgentPanelProps {
  tab: AppTab
}

function basenameFromPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? path
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
    setModel,
    setMode,
    sendMessage,
    resetSession,
  } = useAgentStore()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const safeMessages = messages.filter(
    (message): message is (typeof messages)[number] =>
      Boolean(message) &&
      typeof message.id === 'string' &&
      typeof message.role === 'string' &&
      typeof message.content === 'string' &&
      typeof message.createdAt === 'string',
  )
  const hasStreamingMessage = safeMessages.some((message) => message.streaming === true)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap, tab.id])

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
      await sendMessage(draft)
      setDraft('')
    } finally {
      setSending(false)
    }
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
                  <div className="whitespace-pre-wrap break-words">{message.content || (message.streaming ? '…' : '')}</div>
                </div>
              ))}
              {hasStreamingMessage ? (
                <div className="max-w-[85%] rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <div className="mb-1 text-[11px] uppercase tracking-wide opacity-60">
                    {t('agent.roles.status')}
                  </div>
                  <div>{t('agent.thinking')}</div>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder={t('agent.inputPlaceholder')}
              className="min-h-28 bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {t('agent.contextSummary', {
                  mode: t(`agent.modes.${mode}`),
                  model: model || '-',
                  dir: selectedDir || t('agent.noDirectory'),
                })}
              </div>
              <Button onClick={() => void handleSubmit()} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {t('agent.send')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
