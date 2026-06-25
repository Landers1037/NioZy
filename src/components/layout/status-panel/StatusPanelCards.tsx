import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  Cpu,
  FolderGit2,
  MemoryStick,
  Monitor,
  SquareTerminal,
  Workflow,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppMetricsData, AppSettings } from '../../../../electron/shared/api-types'
import type { ManagedRepoSummary } from '../../../../electron/shared/repo-types'

interface StatusPanelCardsProps {
  settings: AppSettings
  appVersion: string
  runtimeVersions: { electron: string; chromium: string } | null
  platform: NodeJS.Platform
  cpuPercent: number
  memoryPercent: number
  memoryUsedMb: number
  memoryTotalMb: number
  terminalTabCount: number
  activeTerminalTitle: string | null
  repos: ManagedRepoSummary[]
  metrics: AppMetricsData | null
}

const STATUS_DOT: Record<string, string> = {
  blue: 'bg-sky-400',
  green: 'bg-emerald-400',
  orange: 'bg-amber-400',
  purple: 'bg-violet-400',
  rose: 'bg-rose-400',
}

function StatusCard({
  dot,
  label,
  status,
  children,
  className,
}: {
  dot: keyof typeof STATUS_DOT
  label: string
  status?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'border-border/80 bg-card/95 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[dot])} aria-hidden />
          <span>{label}</span>
          {status ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="normal-case tracking-normal">{status}</span>
            </>
          ) : null}
        </div>
        <CardTitle className="sr-only">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  )
}

function platformLabel(platform: NodeJS.Platform, t: (key: string) => string): string {
  if (platform === 'win32') return t('statusPanel.platform.win32')
  if (platform === 'darwin') return t('statusPanel.platform.darwin')
  if (platform === 'linux') return t('statusPanel.platform.linux')
  return platform
}

function MetricBar({ percent, tone }: { percent: number; tone: 'sky' | 'violet' }) {
  const barClass =
    tone === 'sky'
      ? 'bg-sky-500/80 dark:bg-sky-400/70'
      : 'bg-violet-500/80 dark:bg-violet-400/70'
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', barClass)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  )
}

export const StatusPanelCards = memo(function StatusPanelCards({
  settings,
  appVersion,
  runtimeVersions,
  platform,
  cpuPercent,
  memoryPercent,
  memoryUsedMb,
  memoryTotalMb,
  terminalTabCount,
  activeTerminalTitle,
  repos,
  metrics,
}: StatusPanelCardsProps) {
  const { t } = useTranslation()
  const exp = settings.experimental
  const providerKey = `settings.experimental.providers.${exp.aiProvider}`
  const providerLabel = t(providerKey)
  const providerDisplay = providerLabel === providerKey ? exp.aiProvider : providerLabel

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      <StatusCard dot="blue" label={t('statusPanel.system.title')} status={t('statusPanel.system.online')}>
        <dl className="grid gap-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Monitor className="size-3.5 shrink-0" />
              {t('statusPanel.system.platform')}
            </dt>
            <dd className="text-right font-medium">{platformLabel(platform, t)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t('statusPanel.system.version')}</dt>
            <dd className="font-mono text-xs tabular-nums">{appVersion}</dd>
          </div>
          {runtimeVersions ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">{t('statusPanel.system.runtime')}</dt>
              <dd className="text-right font-mono text-[11px] leading-snug tabular-nums text-muted-foreground">
                Electron {runtimeVersions.electron}
                <br />
                Chromium {runtimeVersions.chromium}
              </dd>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t('statusPanel.system.locale')}</dt>
            <dd>{t(`locale.${settings.locale}`)}</dd>
          </div>
        </dl>
      </StatusCard>

      <StatusCard dot="green" label={t('statusPanel.resources.title')} status={`${cpuPercent}% CPU`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3.5" />
                CPU
              </span>
              <span className="font-mono tabular-nums">{cpuPercent}%</span>
            </div>
            <MetricBar percent={cpuPercent} tone="sky" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MemoryStick className="size-3.5" />
                {t('statusPanel.resources.memory')}
              </span>
              <span className="font-mono tabular-nums">{memoryPercent}%</span>
            </div>
            <MetricBar percent={memoryPercent} tone="violet" />
            <p className="text-xs text-muted-foreground">
              {memoryUsedMb} / {memoryTotalMb} MB
            </p>
          </div>
        </div>
      </StatusCard>

      <StatusCard
        dot="orange"
        label={t('statusPanel.terminals.title')}
        status={String(terminalTabCount)}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SquareTerminal className="size-4 text-muted-foreground" />
            <span>
              {t('statusPanel.terminals.count', { count: terminalTabCount })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('statusPanel.terminals.active')}:{' '}
            <span className="font-medium text-foreground">
              {activeTerminalTitle ?? t('statusPanel.terminals.none')}
            </span>
          </p>
        </div>
      </StatusCard>

      {repos.length > 0 ? (
        <StatusCard dot="purple" label={t('statusPanel.repos.title')} status={String(repos.length)}>
          <ul className="flex max-h-32 flex-col gap-2 overflow-y-auto">
            {repos.map((repo) => (
              <li key={repo.id} className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
                <p className="truncate font-medium">{repo.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{repo.path}</p>
                {repo.branch ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderGit2 className="size-3" />
                    {repo.branch}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </StatusCard>
      ) : null}

      <StatusCard
        dot="blue"
        label={t('statusPanel.ai.title')}
        status={settings.experimental.aiSidebarEnabled ? t('statusPanel.ai.enabled') : t('statusPanel.ai.disabled')}
        className={repos.length > 0 ? undefined : 'sm:col-span-2'}
      >
        <dl className="grid gap-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Bot className="size-3.5" />
              {t('settings.experimental.provider')}
            </dt>
            <dd className="text-right font-medium">{providerDisplay}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t('settings.experimental.model')}</dt>
            <dd className="max-w-[180px] truncate text-right font-mono text-xs">{exp.aiModel}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('settings.experimental.baseUrl')}</dt>
            <dd className="truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
              {exp.aiBaseUrl || '—'}
            </dd>
          </div>
        </dl>
      </StatusCard>

      <StatusCard
        dot="rose"
        label={t('statusPanel.processes.title')}
        status={
          metrics
            ? t('statusPanel.processes.count', { count: metrics.processes.length })
            : undefined
        }
        className="sm:col-span-2"
      >
        {metrics ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t('appMetrics.totalWorkingSet')}</dt>
                <dd className="font-mono font-medium tabular-nums">{metrics.totalWorkingSetMb} MB</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('appMetrics.mainRss')}</dt>
                <dd className="font-mono font-medium tabular-nums">{metrics.mainRssMb} MB</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('appMetrics.processCount')}</dt>
                <dd className="font-mono font-medium tabular-nums">{metrics.processes.length}</dd>
              </div>
            </dl>
            <ul className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2">
              {metrics.processes.slice(0, 6).map((p) => (
                <li
                  key={p.pid}
                  className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <Workflow className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.type}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {p.workingSetMb} MB · {p.cpuPercent}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('statusPanel.processes.loading')}</p>
        )}
      </StatusCard>
    </div>
  )
})
