import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI, isElectron } from '@/lib/electron-client'
import { resumeClaudeCodeSession, resumeOpenCodeSession } from '@/lib/session-actions'
import { SESSION_TOOL_ICONS } from '@/components/icons/session-tool-icons'
import type {
  ClaudeCodeSessionEntry,
  ProjectSessionGroup,
  SessionTool,
} from '../../../electron/shared/session-types'
import type { SessionSettings } from '../../../electron/shared/session-settings'

const SESSION_TOOLS: SessionTool[] = ['claudeCode', 'openCode', 'piAgent', 'cline', 'codex']
const IMPLEMENTED_TOOLS = new Set<SessionTool>(['claudeCode', 'openCode'])

function isToolEnabled(tool: SessionTool, session: SessionSettings | undefined): boolean {
  if (!session) return false
  if (tool === 'claudeCode') return session.claudeCodeSessionEnabled === true
  if (tool === 'openCode') return session.openCodeSessionEnabled === true
  if (tool === 'piAgent') return session.piAgentSessionEnabled === true
  if (tool === 'cline') return session.clineSessionEnabled === true
  return session.codexSessionEnabled === true
}

function firstEnabledTool(session: SessionSettings | undefined): SessionTool {
  for (const tool of SESSION_TOOLS) {
    if (isToolEnabled(tool, session)) return tool
  }
  return 'claudeCode'
}

function formatSessionTime(timestamp: number, locale: string): string {
  if (!timestamp) return '—'
  try {
    return new Date(timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US')
  } catch {
    return String(timestamp)
  }
}

function projectLabel(project: string, unknownLabel: string): string {
  if (!project.trim()) return unknownLabel
  const parts = project.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] ?? project
}

function matchesSearch(
  session: ClaudeCodeSessionEntry,
  project: string,
  query: string,
  locale: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const timeText = formatSessionTime(session.timestamp, locale).toLowerCase()
  return (
    session.display.toLowerCase().includes(q) ||
    session.sessionId.toLowerCase().includes(q) ||
    project.toLowerCase().includes(q) ||
    timeText.includes(q)
  )
}

function filterGroups(
  groups: ProjectSessionGroup[],
  query: string,
  locale: string,
): ProjectSessionGroup[] {
  return groups
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((s) => matchesSearch(s, group.project, query, locale)),
    }))
    .filter((group) => group.sessions.length > 0)
}

interface ProjectGroupProps {
  group: ProjectSessionGroup
  expanded: boolean
  onToggle: () => void
  onResume: (session: ClaudeCodeSessionEntry) => void
  resumingId: string | null
}

function ProjectGroup({
  group,
  expanded,
  onToggle,
  onResume,
  resumingId,
}: ProjectGroupProps) {
  const { t, i18n } = useTranslation()
  const label = projectLabel(group.project, t('session.unknownProject'))

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-app-bold hover:bg-muted/50"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-xs font-app-regular text-muted-foreground">
          {t('session.sessionCount', { count: group.sessions.length })}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          {group.project && (
            <div className="border-b border-border/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              {group.project}
            </div>
          )}
          <ul className="divide-y divide-border/60">
            {group.sessions.map((session) => (
              <li
                key={session.sessionId}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-app-regular">
                    {session.display || t('session.untitledSession')}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatSessionTime(session.timestamp, i18n.language)}</span>
                    <span className="font-mono truncate">{session.sessionId}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={resumingId === session.sessionId}
                  onClick={() => onResume(session)}
                >
                  {resumingId === session.sessionId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  {t('session.resume')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SessionManagementPanel() {
  const { t, i18n } = useTranslation()
  const ui = useUiClasses()
  const settings = useAppStore((s) => s.settings)
  const sessionSettings = settings?.session

  const [activeTool, setActiveTool] = useState<SessionTool>(() =>
    firstEnabledTool(sessionSettings),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [groups, setGroups] = useState<ProjectSessionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [resumingId, setResumingId] = useState<string | null>(null)

  const activeToolEnabled = isToolEnabled(activeTool, sessionSettings)
  const activeToolImplemented = IMPLEMENTED_TOOLS.has(activeTool)

  const loadSessions = useCallback(async () => {
    if (!isElectron() || !activeToolImplemented || !activeToolEnabled) {
      setGroups([])
      setLoadError(null)
      return
    }

    setLoading(true)
    setLoadError(null)
    try {
      const api = getElectronAPI().session
      const result =
        activeTool === 'openCode'
          ? await api.listOpenCodeSessions(sessionSettings?.openCodeDbPath)
          : await api.listClaudeCodeSessions(sessionSettings?.claudeCodeHistoryPath)

      if (!result.ok) {
        setGroups([])
        setLoadError(
          result.error === 'FILE_NOT_FOUND'
            ? t('session.errors.fileNotFound')
            : t('session.errors.readFailed'),
        )
        return
      }
      setGroups(result.groups)
      setExpandedProjects(new Set(result.groups.map((g) => g.project)))
    } catch {
      setGroups([])
      setLoadError(t('session.errors.readFailed'))
    } finally {
      setLoading(false)
    }
  }, [
    activeTool,
    activeToolEnabled,
    activeToolImplemented,
    sessionSettings?.claudeCodeHistoryPath,
    sessionSettings?.openCodeDbPath,
    t,
  ])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!isToolEnabled(activeTool, sessionSettings)) {
      setActiveTool(firstEnabledTool(sessionSettings))
    }
  }, [activeTool, sessionSettings])

  const filteredGroups = useMemo(
    () => filterGroups(groups, searchQuery, i18n.language),
    [groups, searchQuery, i18n.language],
  )

  const handleResume = async (session: ClaudeCodeSessionEntry, project: string) => {
    setResumingId(session.sessionId)
    try {
      if (activeTool === 'openCode') {
        await resumeOpenCodeSession(session.sessionId, project || undefined)
      } else {
        await resumeClaudeCodeSession(session.sessionId, project || undefined)
      }
    } finally {
      setResumingId(null)
    }
  }

  const toggleProject = (project: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(project)) next.delete(project)
      else next.add(project)
      return next
    })
  }

  const toolTabs: { id: SessionTool; label: string }[] = SESSION_TOOLS.map((id) => ({
    id,
    label: t(`session.tools.${id}`),
  }))

  return (
    <div className="flex h-full min-h-0 flex-col bg-background select-none">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base font-app-bold">{t('session.title')}</h1>
          {activeToolImplemented && activeToolEnabled && (
            <Button variant="outline" size="sm" onClick={() => void loadSessions()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {t('session.refresh')}
            </Button>
          )}
        </div>

        <div
          className={cn(
            'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
            ui.segmentGroupBg,
          )}
          role="tablist"
          aria-label={t('session.title')}
        >
          {toolTabs.map((tab) => {
            const disabled = !isToolEnabled(tab.id, sessionSettings)
            const Icon = SESSION_TOOL_ICONS[tab.id]
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTool === tab.id}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  activeTool === tab.id
                    ? cn(ui.segmentActive, 'font-app-bold')
                    : cn(ui.segmentInactive, 'font-app-regular'),
                )}
                onClick={() => {
                  if (!disabled) setActiveTool(tab.id)
                }}
              >
                <Icon className="size-3.5 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('session.searchPlaceholder')}
          className="max-w-md"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {!activeToolImplemented || !activeToolEnabled ? (
          <p className="text-sm text-muted-foreground">{t('session.toolNotEnabled')}</p>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('common.loading')}
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : filteredGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim() ? t('session.noSearchResults') : t('session.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredGroups.map((group) => (
              <ProjectGroup
                key={group.project || '__empty__'}
                group={group}
                expanded={expandedProjects.has(group.project)}
                onToggle={() => toggleProject(group.project)}
                onResume={(session) => void handleResume(session, group.project)}
                resumingId={resumingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
