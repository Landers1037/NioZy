import { useTranslation } from 'react-i18next'
import { Minus, Square, X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { getElectronAPI } from '@/lib/electron-client'
import logoUrl from '@/logo.png'

export function TitleBar() {
  const { t } = useTranslation()
  const maximized = useAppStore((s) => s.windowMaximized)

  return (
    <header className="flex h-10 shrink-0 items-center border-b border-border bg-card">
      <div className="flex items-center gap-2 px-3 no-drag">
        <img src={logoUrl} alt="NioZy" className="size-6 object-contain" />
        <span className="font-semibold tracking-tight">NioZy</span>
      </div>
      <div className="drag-region flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {t('app.tagline')}
      </div>
      <div className="flex items-center no-drag">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none hover:bg-muted"
          onClick={() => getElectronAPI().window.minimize()}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none hover:bg-muted"
          onClick={() => getElectronAPI().window.maximize()}
        >
          {maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none hover:bg-destructive hover:text-white"
          onClick={() => getElectronAPI().window.close()}
        >
          <X className="size-4" />
        </Button>
      </div>
    </header>
  )
}
