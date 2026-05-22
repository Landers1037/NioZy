import { useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  CalendarDays,
  Clock,
  Cpu,
  EyeOff,
  FolderOpen,
  MemoryStick,
  SquareTerminal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { useUiClasses, useUiStyle } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import { AppMetricsDialog } from '@/components/layout/AppMetricsDialog'
import type { ThemeMode } from '../../../electron/shared/api-types'

type StatusTagVariant =
  | 'date'
  | 'time'
  | 'cpu'
  | 'memory'
  | 'metric'
  | 'off'
  | 'cwd'
  | 'tab'

const tagVariantsLight: Record<StatusTagVariant, string> = {
  date: 'bg-green-600/14 text-green-950',
  time: 'bg-slate-600/10 text-slate-800',
  cpu: 'bg-sky-600/12 text-sky-950',
  memory: 'bg-violet-600/12 text-violet-950',
  metric: 'bg-rose-600/14 text-rose-950 hover:bg-rose-600/20',
  off: 'bg-muted text-muted-foreground',
  cwd: 'bg-amber-600/12 text-amber-950',
  tab: 'bg-emerald-600/12 text-emerald-950',
}

const tagVariantsDark: Record<StatusTagVariant, string> = {
  date: 'bg-green-500/22 text-green-50',
  time: 'bg-slate-300/12 text-slate-100',
  cpu: 'bg-sky-400/18 text-sky-50',
  memory: 'bg-violet-400/18 text-violet-50',
  metric: 'bg-rose-500/22 text-rose-50 hover:bg-rose-500/30',
  off: 'bg-muted/80 text-muted-foreground',
  cwd: 'bg-amber-400/18 text-amber-50',
  tab: 'bg-emerald-400/18 text-emerald-50',
}

const tabLabelLight = 'text-emerald-900/55'
const tabLabelDark = 'text-emerald-50/60'
const tabDividerLight = 'text-emerald-900/35'
const tabDividerDark = 'text-emerald-50/35'
const cwdLabelLight = 'text-amber-900/55'
const cwdLabelDark = 'text-amber-50/60'
const cwdDividerLight = 'text-amber-900/35'
const cwdDividerDark = 'text-amber-50/35'

function getTagVariants(theme: ThemeMode): Record<StatusTagVariant, string> {
  return theme === 'dark' ? tagVariantsDark : tagVariantsLight
}

const metricTagVariantsLight =
  'border-rose-600/25 bg-rose-600/14 text-rose-950 hover:bg-rose-600/22'
const metricTagVariantsDark =
  'border-rose-400/30 bg-rose-500/22 text-rose-50 hover:bg-rose-500/30'

function StatusTagIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-3 shrink-0 opacity-85" aria-hidden />
}

function StatusTagLabel({
  icon,
  children,
  truncate,
}: {
  icon: LucideIcon
  children: ReactNode
  truncate?: boolean
}) {
  return (
    <>
      <StatusTagIcon icon={icon} />
      <span className={cn('min-w-0', truncate && 'truncate')}>{children}</span>
    </>
  )
}

function NiozyStatusTag({
  children,
  variant,
  theme,
  className,
}: {
  children: ReactNode
  variant: StatusTagVariant
  theme: ThemeMode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight',
        getTagVariants(theme)[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

function MinimalStatusTag({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-normal leading-tight text-foreground/70',
        className,
      )}
    >
      {children}
    </span>
  )
}

function ClassicStatusTag({
  children,
  className,
  fieldClass,
}: {
  children: ReactNode
  className?: string
  fieldClass: string
}) {
  return (
    <span className={cn('inline-flex max-w-full min-h-[18px] items-center', fieldClass, className)}>
      {children}
    </span>
  )
}

function MinimalStatusLabel({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-muted-foreground">{children}</span>
}

function MinimalStatusDivider() {
  return <span className="mx-1 shrink-0 text-muted-foreground/50">·</span>
}

function MetricButton({
  onClick,
  title,
  theme,
  isNiozy,
  isClassic,
  fieldClass,
  renderTag,
  className,
}: {
  onClick: () => void
  title: string
  theme: ThemeMode
  isNiozy: boolean
  isClassic: boolean
  fieldClass: string
  renderTag: (content: ReactNode, className?: string) => ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const label = (
    <StatusTagLabel icon={Activity}>{t('statusBar.metric')}</StatusTagLabel>
  )
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onClick()
  }

  if (isNiozy) {
    return (
      <button
        type="button"
        title={title}
        className={cn(
          'inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors',
          getTagVariants(theme).metric,
          className,
        )}
        onClick={handleClick}
      >
        {label}
      </button>
    )
  }

  if (isClassic) {
    return (
      <button
        type="button"
        title={title}
        className={cn(
          'inline-flex max-w-full min-h-[18px] cursor-pointer items-center gap-1',
          fieldClass,
          theme === 'dark' ? metricTagVariantsDark : metricTagVariantsLight,
          'rounded-md border px-2 py-0.5 text-[11px] font-medium',
          className,
        )}
        onClick={handleClick}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={title}
      className={cn('cursor-pointer', className)}
      onClick={handleClick}
    >
      {renderTag(
        label,
        cn(
          'shrink-0 transition-colors',
          theme === 'dark' ? metricTagVariantsDark : metricTagVariantsLight,
        ),
      )}
    </button>
  )
}

export function StatusBar() {
  const { t } = useTranslation()
  const [metricsOpen, setMetricsOpen] = useState(false)
  const ui = useUiClasses()
  const uiStyle = useUiStyle()
  const stats = useAppStore((s) => s.systemStats)
  const settings = useAppStore((s) => s.settings)
  const theme: ThemeMode = settings?.theme ?? 'light'
  const liveStats = settings?.advanced.statusBarLiveStats !== false
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const terminalCwds = useAppStore((s) => s.terminalCwds)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const activeCwd =
    activeTab?.type === 'terminal' && activeTab.terminalId
      ? terminalCwds[activeTab.terminalId]
      : undefined
  const isDark = theme === 'dark'
  const isNiozy = uiStyle === 'niozy'
  const isClassic = uiStyle === 'windowsClassic'
  const fieldClass = ui.statusTag

  const renderTag = (content: ReactNode, className?: string) => {
    if (isClassic) {
      return (
        <ClassicStatusTag fieldClass={fieldClass} className={className}>
          {content}
        </ClassicStatusTag>
      )
    }
    return <MinimalStatusTag className={className}>{content}</MinimalStatusTag>
  }

  const memoryLabel = t('statusBar.memory', {
    percent: stats.memoryPercent,
    used: stats.memoryUsedMb,
    total: stats.memoryTotalMb,
  })

  return (
    <>
      <footer
        className={cn(
          'flex cursor-pointer select-none items-center justify-between',
          ui.statusBar,
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          {liveStats ? (
            <>
              {isNiozy ? (
                <>
                  <NiozyStatusTag variant="date" theme={theme}>
                    <StatusTagLabel icon={CalendarDays}>{stats.date}</StatusTagLabel>
                  </NiozyStatusTag>
                  <NiozyStatusTag variant="time" theme={theme}>
                    <StatusTagLabel icon={Clock}>{stats.time}</StatusTagLabel>
                  </NiozyStatusTag>
                  <NiozyStatusTag variant="cpu" theme={theme}>
                    <StatusTagLabel icon={Cpu}>
                      {t('statusBar.cpu', { percent: stats.cpuPercent })}
                    </StatusTagLabel>
                  </NiozyStatusTag>
                  <NiozyStatusTag variant="memory" theme={theme} className="truncate">
                    <StatusTagLabel icon={MemoryStick} truncate>
                      {memoryLabel}
                    </StatusTagLabel>
                  </NiozyStatusTag>
                  <MetricButton
                    title={t('statusBar.metricTitle')}
                    theme={theme}
                    isNiozy={isNiozy}
                    isClassic={isClassic}
                    fieldClass={fieldClass}
                    renderTag={renderTag}
                    onClick={() => setMetricsOpen(true)}
                  />
                </>
              ) : (
                <>
                  {renderTag(
                    <StatusTagLabel icon={CalendarDays}>{stats.date}</StatusTagLabel>,
                  )}
                  {renderTag(<StatusTagLabel icon={Clock}>{stats.time}</StatusTagLabel>)}
                  {renderTag(
                    <StatusTagLabel icon={Cpu}>
                      {t('statusBar.cpu', { percent: stats.cpuPercent })}
                    </StatusTagLabel>,
                  )}
                  {renderTag(
                    <StatusTagLabel icon={MemoryStick} truncate>
                      {memoryLabel}
                    </StatusTagLabel>,
                    'truncate',
                  )}
                  <MetricButton
                    title={t('statusBar.metricTitle')}
                    theme={theme}
                    isNiozy={isNiozy}
                    isClassic={isClassic}
                    fieldClass={fieldClass}
                    renderTag={renderTag}
                    onClick={() => setMetricsOpen(true)}
                  />
                </>
              )}
            </>
          ) : isNiozy ? (
          <NiozyStatusTag variant="off" theme={theme}>
            <StatusTagLabel icon={EyeOff}>{t('statusBar.liveStatsOff')}</StatusTagLabel>
          </NiozyStatusTag>
        ) : (
          renderTag(
            <StatusTagLabel icon={EyeOff}>{t('statusBar.liveStatsOff')}</StatusTagLabel>,
          )
        )}
      </div>
      <div className="flex min-w-0 shrink items-center gap-1">
        {activeTab?.type === 'terminal' &&
          (isNiozy ? (
            <NiozyStatusTag variant="cwd" theme={theme} className="max-w-[min(50vw,320px)]">
              <StatusTagIcon icon={FolderOpen} />
              <span className={cn('shrink-0', isDark ? cwdLabelDark : cwdLabelLight)}>
                {t('statusBar.cwd')}
              </span>
              <span className={cn('mx-1 shrink-0', isDark ? cwdDividerDark : cwdDividerLight)}>
                ·
              </span>
              <span className="min-w-0 truncate" title={activeCwd}>
                {activeCwd ?? t('statusBar.cwdUnknown')}
              </span>
            </NiozyStatusTag>
          ) : isClassic ? (
            renderTag(
              <>
                <StatusTagIcon icon={FolderOpen} />
                <span className="shrink-0 text-muted-foreground">{t('statusBar.cwd')}</span>
                <span className="mx-1 shrink-0 text-muted-foreground">·</span>
                <span className="min-w-0 truncate" title={activeCwd}>
                  {activeCwd ?? t('statusBar.cwdUnknown')}
                </span>
              </>,
              'max-w-[min(50vw,320px)]',
            )
          ) : (
            <MinimalStatusTag className="max-w-[min(50vw,320px)]">
              <StatusTagIcon icon={FolderOpen} />
              <MinimalStatusLabel>{t('statusBar.cwd')}</MinimalStatusLabel>
              <MinimalStatusDivider />
              <span className="min-w-0 truncate" title={activeCwd}>
                {activeCwd ?? t('statusBar.cwdUnknown')}
              </span>
            </MinimalStatusTag>
          ))}
        {isNiozy ? (
          <NiozyStatusTag variant="tab" theme={theme} className="max-w-[160px] shrink-0">
            <StatusTagIcon icon={SquareTerminal} />
            <span className={cn('shrink-0', isDark ? tabLabelDark : tabLabelLight)}>
              {t('statusBar.current')}
            </span>
            <span className={cn('mx-1 shrink-0', isDark ? tabDividerDark : tabDividerLight)}>·</span>
            <span
              className="min-w-0 truncate"
              title={activeTab ? getTabDisplayTitle(activeTab) : undefined}
            >
              {activeTab ? getTabDisplayTitle(activeTab) : t('common.none')}
            </span>
          </NiozyStatusTag>
        ) : isClassic ? (
          renderTag(
            <>
              <StatusTagIcon icon={SquareTerminal} />
              <span className="shrink-0 text-muted-foreground">{t('statusBar.current')}</span>
              <span className="mx-1 shrink-0 text-muted-foreground">·</span>
              <span
                className="min-w-0 truncate"
                title={activeTab ? getTabDisplayTitle(activeTab) : undefined}
              >
                {activeTab ? getTabDisplayTitle(activeTab) : t('common.none')}
              </span>
            </>,
            'max-w-[160px] shrink-0',
          )
        ) : (
          <MinimalStatusTag className="max-w-[160px] shrink-0">
            <StatusTagIcon icon={SquareTerminal} />
            <MinimalStatusLabel>{t('statusBar.current')}</MinimalStatusLabel>
            <MinimalStatusDivider />
            <span
              className="min-w-0 truncate"
              title={activeTab ? getTabDisplayTitle(activeTab) : undefined}
            >
              {activeTab ? getTabDisplayTitle(activeTab) : t('common.none')}
            </span>
          </MinimalStatusTag>
        )}
      </div>
      </footer>
      <AppMetricsDialog open={metricsOpen} onOpenChange={setMetricsOpen} />
    </>
  )
}
