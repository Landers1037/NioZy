import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColorSchemePreview } from '@/components/settings/ColorSchemePreview'
import { useAppStore } from '@/stores/app-store'
import {
  COLOR_SCHEME_OPTIONS,
  type TerminalColorScheme,
} from '@/lib/terminal-themes'
import {
  exportTerminalScreenshot,
  type TerminalScreenshotFormat,
  type TerminalScreenshotWatermark,
} from '@/lib/terminal-screenshot'

interface TerminalScreenshotDialogProps {
  tabId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TerminalScreenshotDialog({
  tabId,
  open,
  onOpenChange,
}: TerminalScreenshotDialogProps) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const defaultScheme = settings?.terminal.colorScheme ?? 'atom'

  const [format, setFormat] = useState<TerminalScreenshotFormat>('png')
  const [colorScheme, setColorScheme] = useState<TerminalColorScheme>(defaultScheme)
  const [watermark, setWatermark] = useState<TerminalScreenshotWatermark>('default')
  const [customWatermarkText, setCustomWatermarkText] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFormat('png')
    setColorScheme(defaultScheme)
    setWatermark('default')
    setCustomWatermarkText('')
    setExporting(false)
  }, [open, defaultScheme])

  const handleExport = async () => {
    if (watermark === 'custom' && !customWatermarkText.trim()) {
      return
    }
    setExporting(true)
    try {
      const saved = await exportTerminalScreenshot(tabId, {
        format,
        colorScheme,
        watermark,
        customWatermarkText: customWatermarkText.trim(),
      })
      if (saved) onOpenChange(false)
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tab.terminalScreenshotTitle')}</DialogTitle>
          <DialogDescription>{t('tab.terminalScreenshotDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('tab.terminalScreenshotFormat')}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as TerminalScreenshotFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpg">JPG</SelectItem>
                <SelectItem value="svg">SVG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('tab.terminalScreenshotColorScheme')}</Label>
            <Select
              value={colorScheme}
              onValueChange={(v) => setColorScheme(v as TerminalColorScheme)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COLOR_SCHEME_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ColorSchemePreview schemeId={colorScheme} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('tab.terminalScreenshotWatermark')}</Label>
            <Select
              value={watermark}
              onValueChange={(v) => setWatermark(v as TerminalScreenshotWatermark)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {t('tab.terminalScreenshotWatermarkDefault')}
                </SelectItem>
                <SelectItem value="custom">{t('tab.terminalScreenshotWatermarkCustom')}</SelectItem>
                <SelectItem value="none">{t('tab.terminalScreenshotWatermarkNone')}</SelectItem>
              </SelectContent>
            </Select>
            {watermark === 'custom' ? (
              <Input
                value={customWatermarkText}
                onChange={(e) => setCustomWatermarkText(e.target.value)}
                placeholder={t('tab.terminalScreenshotWatermarkCustomPlaceholder')}
                autoFocus
              />
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void handleExport()}
            disabled={exporting || (watermark === 'custom' && !customWatermarkText.trim())}
          >
            {exporting ? t('tab.terminalScreenshotExporting') : t('tab.terminalScreenshotExport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
