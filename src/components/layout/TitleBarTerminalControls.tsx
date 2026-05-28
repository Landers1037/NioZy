import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Shell, Crop, Search, SquareSplitHorizontal } from 'lucide-react'
import { GpuIcon } from '@/components/icons/GpuIcon'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/stores/app-store'
import { relaunchApp } from '@/lib/app-relaunch'
import { isWtermEmulator, normalizeRendererForEmulator } from '@/lib/terminal-emulator'
import { cn } from '@/lib/utils'
import { getElectronAPI } from '@/lib/electron-client'
import type { TerminalEmulator } from '../../../electron/shared/experimental-settings'
import type { TerminalRenderer } from '../../../electron/shared/api-types'
import { TerminalSearchDialog } from '@/components/layout/TerminalSearchDialog'

const titleBarMenuIconClass = 'size-3.5 shrink-0 text-muted-foreground'

const titleBarMenuBtnClass =
  'h-7 gap-1.5 rounded-full border-border/60 bg-muted/40 px-2.5 text-xs font-normal text-foreground shadow-none hover:bg-muted focus:bg-muted/40 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-muted/40 data-[state=open]:ring-0 active:bg-muted/40'

function notifyEmulatorRestart(t: (key: string) => string) {
  toast.info(t('toast.terminalEmulatorRestart'), {
    duration: 10_000,
    action: {
      label: t('toast.restartApp'),
      onClick: () => relaunchApp(),
    },
  })
}

export function TitleBarTerminalControls() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [searchOpen, setSearchOpen] = useState(false)
  const [snapOpen, setSnapOpen] = useState(false)
  const snapRootRef = useRef<HTMLDivElement | null>(null)
  const snapCloseTimerRef = useRef<number | null>(null)

  if (!settings) return null

  const emulator = settings.experimental.terminalEmulator
  const useWterm = isWtermEmulator(settings)
  const renderer = settings.terminal.renderer

  const engineLabel =
    emulator === 'wterm' ? t('titleBar.engineWterm') : t('titleBar.engineXterm')
  const modeLabel =
    renderer === 'dom'
      ? t('titleBar.modeDom')
      : renderer === 'canvas'
        ? t('titleBar.modeCanvas')
        : t('titleBar.modeWebgl')

  const setEmulator = (next: TerminalEmulator) => {
    if (next === emulator) return
    const normalizedRenderer = normalizeRendererForEmulator(next, settings.terminal.renderer)
    void patchSettings({
      experimental: {
        ...settings.experimental,
        terminalEmulator: next,
      },
      ...(next === 'wterm' && normalizedRenderer !== settings.terminal.renderer
        ? { terminal: { ...settings.terminal, renderer: normalizedRenderer } }
        : {}),
    }).then(() => notifyEmulatorRestart(t))
  }

  const setRenderer = (next: TerminalRenderer) => {
    if (useWterm || next === renderer) return
    void patchSettings({
      terminal: { ...settings.terminal, renderer: next },
    })
  }

  const snap = (
    layout:
      | 'left'
      | 'right'
      | 'top'
      | 'bottom'
      | 'topLeft'
      | 'topRight'
      | 'bottomLeft'
      | 'bottomRight',
  ) => {
    setSnapOpen(false)
    getElectronAPI().window.snap(layout)
  }

  const cancelSnapClose = () => {
    if (snapCloseTimerRef.current) {
      window.clearTimeout(snapCloseTimerRef.current)
      snapCloseTimerRef.current = null
    }
  }

  const scheduleSnapClose = () => {
    cancelSnapClose()
    snapCloseTimerRef.current = window.setTimeout(() => {
      setSnapOpen(false)
      snapCloseTimerRef.current = null
    }, 200)
  }

  useEffect(() => {
    if (!snapOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSnapOpen(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [snapOpen])

  useEffect(() => {
    return () => cancelSnapClose()
  }, [])

  return (
    <div className="flex items-center gap-1.5 border-r border-border pr-2 mr-0.5">
      <Button
        variant="outline"
        size="icon"
        className={cn(titleBarMenuBtnClass, 'w-7 px-0')}
        aria-label={t('titleBar.search')}
        title={t('titleBar.search')}
        onClick={() => setSearchOpen(true)}
      >
        <Search className={titleBarMenuIconClass} aria-hidden />
      </Button>

      <div
        ref={snapRootRef}
        className="relative"
        onMouseEnter={() => {
          cancelSnapClose()
          setSnapOpen(true)
        }}
        onMouseLeave={() => {
          if (!snapOpen) return
          scheduleSnapClose()
        }}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(titleBarMenuBtnClass, 'w-7 px-0')}
          aria-label={t('titleBar.snap')}
          title={t('titleBar.snap')}
          onClick={() => setSnapOpen(true)}
        >
          <SquareSplitHorizontal className={titleBarMenuIconClass} aria-hidden />
        </Button>

        {snapOpen ? (
          <div
            className="absolute left-1/2 top-full z-50 w-[320px] -translate-x-1/2 translate-y-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur"
            onMouseEnter={() => cancelSnapClose()}
            onMouseLeave={() => scheduleSnapClose()}
          >
            <div className="px-2 pb-2 text-[11px] text-muted-foreground">
              {t('titleBar.snapHint')}
            </div>

            {/* Windows/VS Code 风格：每个布局是一组矩形组合，hover 高亮、点击触发 */}
            <div className="grid grid-cols-3 gap-2 px-1 pb-1">
              {/* 左右 50/50 */}
              <div className="rounded-lg border border-border/70 bg-muted/15 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-12 rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('left')}
                    aria-label={t('titleBar.snapLayout.left')}
                    title={t('titleBar.snapLayout.left')}
                  />
                  <button
                    type="button"
                    className="h-12 rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('right')}
                    aria-label={t('titleBar.snapLayout.right')}
                    title={t('titleBar.snapLayout.right')}
                  />
                </div>
              </div>

              {/* 上下 50/50 */}
              <div className="rounded-lg border border-border/70 bg-muted/15 p-2">
                <div className="grid grid-rows-2 gap-2">
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('top')}
                    aria-label={t('titleBar.snapLayout.top')}
                    title={t('titleBar.snapLayout.top')}
                  />
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('bottom')}
                    aria-label={t('titleBar.snapLayout.bottom')}
                    title={t('titleBar.snapLayout.bottom')}
                  />
                </div>
              </div>

              {/* 四象限 */}
              <div className="rounded-lg border border-border/70 bg-muted/15 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('topLeft')}
                    aria-label={t('titleBar.snapLayout.topLeft')}
                    title={t('titleBar.snapLayout.topLeft')}
                  />
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('topRight')}
                    aria-label={t('titleBar.snapLayout.topRight')}
                    title={t('titleBar.snapLayout.topRight')}
                  />
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('bottomLeft')}
                    aria-label={t('titleBar.snapLayout.bottomLeft')}
                    title={t('titleBar.snapLayout.bottomLeft')}
                  />
                  <button
                    type="button"
                    className="h-[22px] rounded-md border border-border/70 bg-background/50 hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-ring/40"
                    onClick={() => snap('bottomRight')}
                    aria-label={t('titleBar.snapLayout.bottomRight')}
                    title={t('titleBar.snapLayout.bottomRight')}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="icon"
        className={cn(titleBarMenuBtnClass, 'w-7 px-0')}
        aria-label={t('titleBar.screenshot')}
        title={t('titleBar.screenshot')}
        onClick={() => getElectronAPI().screenshot.open()}
      >
        <Crop className={titleBarMenuIconClass} aria-hidden />
      </Button>

      <TerminalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={titleBarMenuBtnClass}
            aria-label={t('titleBar.renderEngine')}
          >
            <Shell className={titleBarMenuIconClass} strokeWidth={2} aria-hidden />
            <span className="max-w-[5.5rem] truncate">{engineLabel}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          <DropdownMenuItem onSelect={() => setEmulator('xterm')}>
            <span className="flex-1">{t('titleBar.engineXterm')}</span>
            {emulator === 'xterm' ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEmulator('wterm')}>
            <span className="flex-1">{t('titleBar.engineWterm')}</span>
            {emulator === 'wterm' ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(titleBarMenuBtnClass, useWterm && 'opacity-60')}
            disabled={useWterm}
            aria-label={t('titleBar.renderMode')}
            title={useWterm ? t('titleBar.renderModeWtermHint') : undefined}
          >
            <GpuIcon className={titleBarMenuIconClass} />
            <span className="max-w-[5.5rem] truncate">{modeLabel}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          <DropdownMenuItem onSelect={() => setRenderer('dom')}>
            <span className="flex-1">{t('titleBar.modeDom')}</span>
            {renderer === 'dom' ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenderer('canvas')}>
            <span className="flex-1">{t('titleBar.modeCanvas')}</span>
            {renderer === 'canvas' ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenderer('webgl')}>
            <span className="flex-1">{t('titleBar.modeWebgl')}</span>
            {renderer === 'webgl' ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
