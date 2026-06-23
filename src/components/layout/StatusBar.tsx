import { memo, useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
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
import { getActiveTerminalId } from '@/lib/terminal-tab-utils'
import { AppMetricsDialog } from '@/components/layout/AppMetricsDialog'
import { BatteryStatusIndicator } from '@/components/layout/BatteryStatusIndicator'
import { useStatusBarClock } from '@/hooks/useStatusBarClock'
import type { ThemeMode } from '../../../electron/shared/api-types'
import type { UiStyle } from '../../../electron/shared/ui-style'

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

const cyberTagVariantsLight: Record<StatusTagVariant, string> = {
  date: 'border border-[#c4a800]/45 bg-[#c4a800]/14 text-[#6b5800]',
  time: 'border border-[#0099cc]/45 bg-[#0099cc]/12 text-[#005577]',
  cpu: 'border border-[#c4006a]/45 bg-[#c4006a]/12 text-[#8a0048]',
  memory: 'border border-[#7a00cc]/45 bg-[#7a00cc]/12 text-[#4a0080]',
  metric: 'border border-[#c4006a]/45 bg-[#c4006a]/14 text-[#8a0048] hover:bg-[#c4006a]/22',
  off: 'border border-border bg-muted text-muted-foreground',
  cwd: 'border border-[#c4a800]/40 bg-[#c4a800]/10 text-[#6b5800]',
  tab: 'border border-[#0099cc]/40 bg-[#0099cc]/10 text-[#005577]',
}

const cyberTagVariantsDark: Record<StatusTagVariant, string> = {
  date: 'border border-[#fcee0a]/45 bg-[#fcee0a]/12 text-[#fcee0a] shadow-[0_0_8px_rgb(252_238_10/0.2)]',
  time: 'border border-[#00f0ff]/45 bg-[#00f0ff]/10 text-[#00f0ff] shadow-[0_0_8px_rgb(0_240_255/0.2)]',
  cpu: 'border border-[#ff2a6d]/45 bg-[#ff2a6d]/10 text-[#ff2a6d] shadow-[0_0_8px_rgb(255_42_109/0.2)]',
  memory: 'border border-[#bd00ff]/45 bg-[#bd00ff]/10 text-[#bd00ff] shadow-[0_0_8px_rgb(189_0_255/0.2)]',
  metric:
    'border border-[#ff2a6d]/45 bg-[#ff2a6d]/12 text-[#ff2a6d] shadow-[0_0_8px_rgb(255_42_109/0.2)] hover:bg-[#ff2a6d]/20',
  off: 'border border-border/60 bg-muted/80 text-muted-foreground',
  cwd: 'border border-[#fcee0a]/35 bg-[#fcee0a]/8 text-[#fcee0a]',
  tab: 'border border-[#00f0ff]/35 bg-[#00f0ff]/8 text-[#00f0ff]',
}

function getTagVariants(theme: ThemeMode, uiStyle?: UiStyle): Record<StatusTagVariant, string> {
  if (uiStyle === 'cyberpunk') {
    return theme === 'dark' ? cyberTagVariantsDark : cyberTagVariantsLight
  }
  return theme === 'dark' ? tagVariantsDark : tagVariantsLight
}

function usesColoredStatusTags(uiStyle: UiStyle): boolean {
  return uiStyle === 'niozy' || uiStyle === 'cyberpunk' || uiStyle === 'glass'
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
  uiStyle,
  className,
}: {
  children: ReactNode
  variant: StatusTagVariant
  theme: ThemeMode
  uiStyle: UiStyle
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight',
        getTagVariants(theme, uiStyle)[variant],
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
  uiStyle,
  isClassic,
  fieldClass,
  renderTag,
  className,
}: {
  onClick: () => void
  title: string
  theme: ThemeMode
  uiStyle: UiStyle
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

  if (usesColoredStatusTags(uiStyle)) {
    return (
      <button
        type="button"
        title={title}
        className={cn(
          'inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors',
          getTagVariants(theme, uiStyle).metric,
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

const StatusBarLiveStats = memo(function StatusBarLiveStats({
  onOpenMetrics,
}: {
  onOpenMetrics: () => void
}) {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const uiStyle = useUiStyle()
  const stats = useAppStore((s) => s.systemStats)
  const theme: ThemeMode = useAppStore((s) => s.settings?.theme ?? 'light')
  const liveStats = useAppStore((s) => s.settings?.advanced.statusBarLiveStats !== false)
  const showBattery = useAppStore((s) => s.settings?.advanced.statusBarBattery === true)
  const { date: statusDate, time: statusTime } = useStatusBarClock(liveStats)
  const isClassic = uiStyle === 'windowsClassic'
  const coloredTags = usesColoredStatusTags(uiStyle)
  const fieldClass = ui.statusTag

  const renderTag = useCallback(
    (content: ReactNode, className?: string) => {
      if (isClassic) {
        return (
          <ClassicStatusTag fieldClass={fieldClass} className={className}>
            {content}
          </ClassicStatusTag>
        )
      }
      return <MinimalStatusTag className={className}>{content}</MinimalStatusTag>
    },
    [fieldClass, isClassic],
  )

  const memoryLabel = useMemo(
    () =>
      t('statusBar.memory', {
        percent: stats.memoryPercent,
        used: stats.memoryUsedMb,
        total: stats.memoryTotalMb,
      }),
    [stats.memoryPercent, stats.memoryUsedMb, stats.memoryTotalMb, t],
  )

  const batteryIndicator = showBattery ? (
    <BatteryStatusIndicator
      percent={stats.batteryPercent}
      isCharging={stats.batteryCharging}
      theme={theme}
      uiStyle={uiStyle}
      isClassic={isClassic}
      fieldClass={fieldClass}
      renderTag={renderTag}
    />
  ) : null

  if (!liveStats) {
    if (showBattery) {
      return <>{batteryIndicator}</>
    }
    if (coloredTags) {
      return (
        <NiozyStatusTag variant="off" theme={theme} uiStyle={uiStyle}>
          <StatusTagLabel icon={EyeOff}>{t('statusBar.liveStatsOff')}</StatusTagLabel>
        </NiozyStatusTag>
      )
    }
    return renderTag(
      <StatusTagLabel icon={EyeOff}>{t('statusBar.liveStatsOff')}</StatusTagLabel>,
    )
  }

  if (coloredTags) {
    return (
      <>
        <NiozyStatusTag variant="date" theme={theme} uiStyle={uiStyle}>
          <StatusTagLabel icon={CalendarDays}>{statusDate}</StatusTagLabel>
        </NiozyStatusTag>
        <NiozyStatusTag variant="time" theme={theme} uiStyle={uiStyle}>
          <StatusTagLabel icon={Clock}>{statusTime}</StatusTagLabel>
        </NiozyStatusTag>
        <NiozyStatusTag variant="cpu" theme={theme} uiStyle={uiStyle}>
          <StatusTagLabel icon={Cpu}>
            {t('statusBar.cpu', { percent: stats.cpuPercent })}
          </StatusTagLabel>
        </NiozyStatusTag>
        <NiozyStatusTag variant="memory" theme={theme} uiStyle={uiStyle} className="truncate">
          <StatusTagLabel icon={MemoryStick} truncate>
            {memoryLabel}
          </StatusTagLabel>
        </NiozyStatusTag>
        {batteryIndicator}
        <MetricButton
          title={t('statusBar.metricTitle')}
          theme={theme}
          uiStyle={uiStyle}
          isClassic={isClassic}
          fieldClass={fieldClass}
          renderTag={renderTag}
          onClick={onOpenMetrics}
        />
      </>
    )
  }

  return (
    <>
      {renderTag(<StatusTagLabel icon={CalendarDays}>{statusDate}</StatusTagLabel>)}
      {renderTag(<StatusTagLabel icon={Clock}>{statusTime}</StatusTagLabel>)}
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
      {batteryIndicator}
      <MetricButton
        title={t('statusBar.metricTitle')}
        theme={theme}
        uiStyle={uiStyle}
        isClassic={isClassic}
        fieldClass={fieldClass}
        renderTag={renderTag}
        onClick={onOpenMetrics}
      />
    </>
  )
})

const StatusBarTabInfo = memo(function StatusBarTabInfo() {
  const { t } = useTranslation()
  const ui = useUiClasses()
  const uiStyle = useUiStyle()
  const theme: ThemeMode = useAppStore((s) => s.settings?.theme ?? 'light')
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const terminalCwds = useAppStore((s) => s.terminalCwds)
  const isDark = theme === 'dark'
  const coloredTags = usesColoredStatusTags(uiStyle)
  const isClassic = uiStyle === 'windowsClassic'
  const fieldClass = ui.statusTag

  const { activeTab, activeCwd, activeTabTitle } = useMemo(() => {
    const tab = tabs.find((item) => item.id === activeTabId)
    const terminalId = tab?.type === 'terminal' ? getActiveTerminalId(tab) : undefined
    return {
      activeTab: tab,
      activeCwd: terminalId ? terminalCwds[terminalId] : undefined,
      activeTabTitle: tab ? getTabDisplayTitle(tab) : t('common.none'),
    }
  }, [activeTabId, tabs, terminalCwds, t])

  const renderTag = useCallback(
    (content: ReactNode, className?: string) => {
      if (isClassic) {
        return (
          <ClassicStatusTag fieldClass={fieldClass} className={className}>
            {content}
          </ClassicStatusTag>
        )
      }
      return <MinimalStatusTag className={className}>{content}</MinimalStatusTag>
    },
    [fieldClass, isClassic],
  )

  return (
    <>
      {activeTab?.type === 'terminal' &&
        (coloredTags ? (
          <NiozyStatusTag variant="cwd" theme={theme} uiStyle={uiStyle} className="max-w-[min(50vw,320px)]">
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
      {coloredTags ? (
        <NiozyStatusTag variant="tab" theme={theme} uiStyle={uiStyle} className="max-w-[160px] shrink-0">
          <StatusTagIcon icon={SquareTerminal} />
          <span className={cn('shrink-0', isDark ? tabLabelDark : tabLabelLight)}>
            {t('statusBar.current')}
          </span>
          <span className={cn('mx-1 shrink-0', isDark ? tabDividerDark : tabDividerLight)}>·</span>
          <span className="min-w-0 truncate" title={activeTab ? activeTabTitle : undefined}>
            {activeTabTitle}
          </span>
        </NiozyStatusTag>
      ) : isClassic ? (
        renderTag(
          <>
            <StatusTagIcon icon={SquareTerminal} />
            <span className="shrink-0 text-muted-foreground">{t('statusBar.current')}</span>
            <span className="mx-1 shrink-0 text-muted-foreground">·</span>
            <span className="min-w-0 truncate" title={activeTab ? activeTabTitle : undefined}>
              {activeTabTitle}
            </span>
          </>,
          'max-w-[160px] shrink-0',
        )
      ) : (
        <MinimalStatusTag className="max-w-[160px] shrink-0">
          <StatusTagIcon icon={SquareTerminal} />
          <MinimalStatusLabel>{t('statusBar.current')}</MinimalStatusLabel>
          <MinimalStatusDivider />
          <span className="min-w-0 truncate" title={activeTab ? activeTabTitle : undefined}>
            {activeTabTitle}
          </span>
        </MinimalStatusTag>
      )}
    </>
  )
})

export function StatusBar() {
  const ui = useUiClasses()
  const [metricsOpen, setMetricsOpen] = useState(false)
  const openMetrics = useCallback(() => setMetricsOpen(true), [])

  return (
    <>
      <footer
        className={cn(
          'flex cursor-pointer select-none items-center justify-between',
          ui.statusBar,
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          <StatusBarLiveStats onOpenMetrics={openMetrics} />
        </div>
        <div className="flex min-w-0 shrink items-center gap-1">
          <StatusBarTabInfo />
        </div>
      </footer>
      <AppMetricsDialog open={metricsOpen} onOpenChange={setMetricsOpen} />
    </>
  )
}
