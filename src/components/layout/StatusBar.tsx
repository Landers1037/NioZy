import type { ReactNode } from 'react'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '../../../electron/shared/api-types'

type StatusTagVariant = 'date' | 'time' | 'cpu' | 'memory' | 'off' | 'tab'

const tagVariantsLight: Record<StatusTagVariant, string> = {
  date: 'bg-green-600/14 text-green-950',
  time: 'bg-slate-600/10 text-slate-800',
  cpu: 'bg-sky-600/12 text-sky-950',
  memory: 'bg-violet-600/12 text-violet-950',
  off: 'bg-muted text-muted-foreground',
  tab: 'bg-emerald-600/12 text-emerald-950',
}

const tagVariantsDark: Record<StatusTagVariant, string> = {
  date: 'bg-green-500/22 text-green-50',
  time: 'bg-slate-300/12 text-slate-100',
  cpu: 'bg-sky-400/18 text-sky-50',
  memory: 'bg-violet-400/18 text-violet-50',
  off: 'bg-muted/80 text-muted-foreground',
  tab: 'bg-emerald-400/18 text-emerald-50',
}

const tabLabelLight = 'text-emerald-900/55'
const tabLabelDark = 'text-emerald-50/60'
const tabDividerLight = 'text-emerald-900/35'
const tabDividerDark = 'text-emerald-50/35'

function getTagVariants(theme: ThemeMode): Record<StatusTagVariant, string> {
  return theme === 'dark' ? tagVariantsDark : tagVariantsLight
}

function StatusTag({
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

export function StatusBar() {
  const stats = useAppStore((s) => s.systemStats)
  const settings = useAppStore((s) => s.settings)
  const theme: ThemeMode = settings?.theme ?? 'light'
  const liveStats = settings?.advanced.statusBarLiveStats !== false
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isDark = theme === 'dark'

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {liveStats ? (
          <>
            <StatusTag variant="date" theme={theme}>
              {stats.date}
            </StatusTag>
            <StatusTag variant="time" theme={theme}>
              {stats.time}
            </StatusTag>
            <StatusTag variant="cpu" theme={theme}>
              CPU {stats.cpuPercent}%
            </StatusTag>
            <StatusTag variant="memory" theme={theme} className="truncate">
              内存 {stats.memoryPercent}% · {stats.memoryUsedMb}/{stats.memoryTotalMb} MB
            </StatusTag>
          </>
        ) : (
          <StatusTag variant="off" theme={theme}>
            系统监控已关闭
          </StatusTag>
        )}
      </div>
      <StatusTag variant="tab" theme={theme} className="shrink-0 truncate">
        <span className={isDark ? tabLabelDark : tabLabelLight}>当前</span>
        <span className={cn('mx-1', isDark ? tabDividerDark : tabDividerLight)}>·</span>
        <span className="truncate">{activeTab?.title ?? '无'}</span>
      </StatusTag>
    </footer>
  )
}
