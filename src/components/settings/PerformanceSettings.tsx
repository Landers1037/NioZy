import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Gauge, Moon, Sparkles } from 'lucide-react'

export function PerformanceSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const performance = settings.performance

  const patchPerformance = (partial: Partial<typeof performance>) =>
    patchSettings({ performance: { ...performance, ...partial } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-5" />
          {t('settings.performance.title')}
        </CardTitle>
        <CardDescription>{t('settings.performance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Sparkles}
          label={t('settings.performance.inactiveTabOptimization')}
          description={t('settings.performance.inactiveTabOptimizationDesc')}
          row
        >
          <Switch
            checked={performance.inactiveTabOptimization}
            onCheckedChange={(v) => patchPerformance({ inactiveTabOptimization: v })}
          />
        </SettingField>

        <SettingField
          icon={Moon}
          label={t('settings.performance.inactiveTabSleep')}
          description={t('settings.performance.inactiveTabSleepDesc')}
          row
        >
          <Switch
            checked={performance.inactiveTabSleep}
            onCheckedChange={(v) => patchPerformance({ inactiveTabSleep: v })}
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
