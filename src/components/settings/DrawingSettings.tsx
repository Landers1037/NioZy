import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { PenTool, LineSquiggle } from 'lucide-react'

export function DrawingSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const closeExcalidrawTabIfPresent = useAppStore((s) => s.closeExcalidrawTabIfPresent)
  const closeDrawioTabIfPresent = useAppStore((s) => s.closeDrawioTabIfPresent)
  if (!settings) return null

  const drawing = settings.drawing

  const patchDrawing = (partial: Partial<typeof drawing>) =>
    patchSettings({ drawing: { ...drawing, ...partial } })

  const handleExcalidrawToggle = (enabled: boolean) => {
    patchDrawing({ excalidrawEnabled: enabled })
    if (!enabled) closeExcalidrawTabIfPresent()
  }

  const handleDrawioToggle = (enabled: boolean) => {
    patchDrawing({ drawioEnabled: enabled })
    if (!enabled) closeDrawioTabIfPresent()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="size-5" />
          {t('settings.drawing.title')}
        </CardTitle>
        <CardDescription>{t('settings.drawing.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={PenTool}
          label={t('settings.drawing.excalidrawEnabled')}
          description={t('settings.drawing.excalidrawEnabledDesc')}
          row
        >
          <Switch
            checked={drawing.excalidrawEnabled}
            onCheckedChange={(v) => handleExcalidrawToggle(v)}
          />
        </SettingField>

        <SettingField
          icon={LineSquiggle}
          label={t('settings.drawing.drawioEnabled')}
          description={t('settings.drawing.drawioEnabledDesc')}
          row
        >
          <Switch
            checked={drawing.drawioEnabled}
            onCheckedChange={(v) => handleDrawioToggle(v)}
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
