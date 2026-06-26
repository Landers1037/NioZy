import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useTransform } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { getTabDisplayTitle } from '@/lib/tab-display'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'
import type { AppMetricsData } from '../../../../electron/shared/api-types'
import type { ManagedRepoSummary } from '../../../../electron/shared/repo-types'
import { StatusPanelCards } from './StatusPanelCards'
import { STATUS_PANEL_HANDLE, useStatusPanelDrag } from './useStatusPanelDrag'

export function StatusPanelSlider() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const stats = useAppStore((s) => s.systemStats)
  const measureRef = useRef<HTMLDivElement>(null)
  const [panelWidth, setPanelWidth] = useState(0)
  const { progress, onHandlePointerDown } = useStatusPanelDrag(panelWidth, 0)

  const [appVersion, setAppVersion] = useState('—')
  const [runtimeVersions, setRuntimeVersions] = useState<{
    electron: string
    chromium: string
  } | null>(null)
  const [repos, setRepos] = useState<ManagedRepoSummary[]>([])
  const [metrics, setMetrics] = useState<AppMetricsData | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const platform = getElectronAPI().system.platform

  // start half-open: progress = 0.5 → panel is shifted right by 50%,
  // handle sits at the panel's left edge with half of it hidden off-screen.
  const panelX = useTransform(progress, [0, 1], ['100%', '0%'])
  const panelOpacity = useTransform(progress, [0, 0.04, 0.1], [0, 0, 1])
  const dividerOpacity = useTransform(progress, [0, 0.1, 0.18], [0, 0, 1])

  useEffect(() => {
    const el = measureRef.current
    if (!el) return

    const syncWidth = () => setPanelWidth(el.clientWidth)

    syncWidth()
    const ro = new ResizeObserver(() => syncWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const unsub = progress.on('change', (v) => {
      setPanelOpen(v > 0.08)
    })
    return unsub
  }, [progress])

  useEffect(() => {
    const api = getElectronAPI()
    void api.app.getVersion().then(setAppVersion)
    void api.app.getRuntimeVersions().then(setRuntimeVersions)
    void api.repo.listManaged().then(setRepos).catch(() => setRepos([]))
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const api = getElectronAPI()
    let cancelled = false

    const load = () => {
      void api.system.getAppMetrics().then((data) => {
        if (!cancelled) setMetrics(data)
      })
    }

    load()
    const id = window.setInterval(load, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [panelOpen])

  const terminalTabCount = useMemo(
    () => tabs.filter((tab) => tab.type === 'terminal').length,
    [tabs],
  )

  const activeTerminalTitle = useMemo(() => {
    const active = tabs.find((tab) => tab.id === activeTabId)
    if (!active || active.type !== 'terminal') return null
    return getTabDisplayTitle(active)
  }, [tabs, activeTabId])

  if (!settings) return null

  return (
    <div
      ref={measureRef}
      className="pointer-events-none absolute inset-0 z-50"
      aria-hidden={!panelOpen}
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className={cn(
            'pointer-events-auto absolute inset-0 right-0 w-full transform-gpu',
            'will-change-transform',
          )}
          style={{ x: panelX }}
        >
          <div className="relative h-full">
            <motion.div
              className="absolute inset-y-0 left-0 w-px bg-border shadow-[0_0_16px_rgba(0,0,0,0.12)] dark:bg-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.12)]"
              style={{ opacity: dividerOpacity }}
              aria-hidden
            />

            <motion.aside
              className={cn(
                'flex h-full w-full flex-col overflow-hidden',
                'border-l border-border/80 bg-background/95 backdrop-blur-md',
              )}
              style={{ opacity: panelOpacity }}
              aria-label={t('statusPanel.ariaLabel')}
            >
              <header className="shrink-0 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-app-bold tracking-tight">{t('statusPanel.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('statusPanel.subtitle')}</p>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <StatusPanelCards
                  settings={settings}
                  appVersion={appVersion}
                  runtimeVersions={runtimeVersions}
                  platform={platform}
                  cpuPercent={stats.cpuPercent}
                  memoryPercent={stats.memoryPercent}
                  memoryUsedMb={stats.memoryUsedMb}
                  memoryTotalMb={stats.memoryTotalMb}
                  terminalTabCount={terminalTabCount}
                  activeTerminalTitle={activeTerminalTitle}
                  repos={repos}
                  metrics={metrics}
                />
              </div>
            </motion.aside>

            <button
              type="button"
              className={cn(
                'pointer-events-auto absolute top-1/2 z-[60] flex -translate-y-1/2 items-center justify-center',
                'rounded-full border border-border/80 text-sm font-mono text-foreground',
                'shadow-[0_8px_24px_rgba(0,0,0,0.16)] ring-1 ring-black/5 backdrop-blur-md',
                'cursor-col-resize touch-none select-none dark:border-white/20 dark:bg-white/92 dark:text-foreground dark:ring-white/10',
                'dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
                'dark:bg-color-mix(in oklab, #1f1e1e 90%, transparent)',
                'transition-[scale,box-shadow] hover:scale-105 active:scale-110',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              style={{
                left: `-${STATUS_PANEL_HANDLE / 2}px`,
                width: STATUS_PANEL_HANDLE,
                height: STATUS_PANEL_HANDLE,
                willChange: 'transform',
              }}
              aria-label={t('statusPanel.handleAria')}
              aria-expanded={panelOpen}
              onPointerDown={onHandlePointerDown}
            >
              <span aria-hidden className="tracking-tighter opacity-80 text-md">
                &lt;&gt;
              </span>
            </button>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
