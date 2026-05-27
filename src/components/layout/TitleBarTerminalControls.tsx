import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Shell } from 'lucide-react'
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
import type { TerminalEmulator } from '../../../electron/shared/experimental-settings'
import type { TerminalRenderer } from '../../../electron/shared/api-types'

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

  return (
    <div className="flex items-center gap-1.5 border-r border-border pr-2 mr-0.5">
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
