import { Minus, Square, X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import { useUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'
import { TitleBarTerminalControls } from '@/components/layout/TitleBarTerminalControls'
import logoUrl from '@/logo.png'

export function TitleBar() {
  const maximized = useAppStore((s) => s.windowMaximized)
  const showAppTitle = useAppStore((s) => s.settings?.showAppTitle ?? true)
  const ui = useUiClasses()

  return (
    <header className={cn('drag-region flex shrink-0 select-none items-center', ui.titleBar)}>
      <div className="flex items-center gap-2 px-2">
        <img src={logoUrl} alt="NioZy" className="size-8 object-contain" draggable={false} />
        {showAppTitle && (
          <span className={cn(ui.titleWeight, 'tracking-tight')}>NioZy</span>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1" aria-hidden />
      <div className="flex shrink-0 items-center gap-0.5 pr-2">
        <TitleBarTerminalControls />
        <Button
          variant="ghost"
          size="icon"
          className={ui.windowControlBtn}
          onClick={() => getElectronAPI().window.minimize()}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={ui.windowControlBtn}
          onClick={() => getElectronAPI().window.maximize()}
        >
          {maximized ? <Copy className="size-3" /> : <Square className="size-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={ui.windowCloseBtn}
          onClick={() => getElectronAPI().window.close()}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </header>
  )
}
