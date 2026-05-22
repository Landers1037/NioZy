import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { useUiClasses, useUiStyle } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '../../../electron/shared/api-types'

type StatusTagVariant = 'date' | 'time' | 'cpu' | 'memory' | 'off' | 'cwd' | 'tab'

const tagVariantsLight: Record<StatusTagVariant, string> = {
  date: 'bg-green-600/14 text-green-950',
  time: 'bg-slate-600/10 text-slate-800',
  cpu: 'bg-sky-600/12 text-sky-950',
  memory: 'bg-violet-600/12 text-violet-950',
  off: 'bg-muted text-muted-foreground',
  cwd: 'bg-amber-600/12 text-amber-950',
  tab: 'bg-emerald-600/12 text-emerald-950',
}

const tagVariantsDark: Record<StatusTagVariant, string> = {
  date: 'bg-green-500/22 text-green-50',
  time: 'bg-slate-300/12 text-slate-100',
  cpu: 'bg-sky-400/18 text-sky-50',
  memory: 'bg-violet-400/18 text-violet-50',
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
        'inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight',
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
        'inline-flex max-w-full items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-normal leading-tight text-foreground/70',
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

export function StatusBar() {
  const { t } = useTranslation()
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

  return (
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
                  {stats.date}
                </NiozyStatusTag>
                <NiozyStatusTag variant="time" theme={theme}>
                  {stats.time}
                </NiozyStatusTag>
                <NiozyStatusTag variant="cpu" theme={theme}>
                  {t('statusBar.cpu', { percent: stats.cpuPercent })}
                </NiozyStatusTag>
                <NiozyStatusTag variant="memory" theme={theme} className="truncate">
                  {t('statusBar.memory', {
                    percent: stats.memoryPercent,
                    used: stats.memoryUsedMb,
                    total: stats.memoryTotalMb,
                  })}
                </NiozyStatusTag>
              </>
            ) : (
              <>
                {renderTag(stats.date)}
                {renderTag(stats.time)}
                {renderTag(t('statusBar.cpu', { percent: stats.cpuPercent }))}
                {renderTag(
                  t('statusBar.memory', {
                    percent: stats.memoryPercent,
                    used: stats.memoryUsedMb,
                    total: stats.memoryTotalMb,
                  }),
                  'truncate',
                )}
              </>
            )}
          </>
        ) : isNiozy ? (
          <NiozyStatusTag variant="off" theme={theme}>
            {t('statusBar.liveStatsOff')}
          </NiozyStatusTag>
        ) : (
          renderTag(t('statusBar.liveStatsOff'))
        )}
      </div>
      <div className="flex min-w-0 shrink items-center gap-1">
        {activeTab?.type === 'terminal' &&
          (isNiozy ? (
            <NiozyStatusTag variant="cwd" theme={theme} className="max-w-[min(50vw,320px)]">
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
              <MinimalStatusLabel>{t('statusBar.cwd')}</MinimalStatusLabel>
              <MinimalStatusDivider />
              <span className="min-w-0 truncate" title={activeCwd}>
                {activeCwd ?? t('statusBar.cwdUnknown')}
              </span>
            </MinimalStatusTag>
          ))}
        {isNiozy ? (
          <NiozyStatusTag variant="tab" theme={theme} className="max-w-[160px] shrink-0">
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
  )
}
