import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Activity, Cpu, Droplets, ShieldOff } from 'lucide-react'

export function AdvancedSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.advanced.title')}</CardTitle>
        <CardDescription>{t('settings.advanced.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Cpu}
          label={t('settings.advanced.hardwareAcceleration')}
          description={t('settings.advanced.hardwareAccelerationDesc')}
          row
        >
          <Switch
            checked={settings.advanced.hardwareAcceleration}
            onCheckedChange={(v) => {
              if (v === settings.advanced.hardwareAcceleration) return
              void patchSettings({
                advanced: { ...settings.advanced, hardwareAcceleration: v },
              }).then(() => toast.info(t('toast.hardwareAccelerationRestart')))
            }}
          />
        </SettingField>

        <SettingField
          icon={ShieldOff}
          label={t('settings.advanced.disableSandbox')}
          description={t('settings.advanced.disableSandboxDesc')}
          row
        >
          <Switch
            checked={settings.advanced.disableSandbox}
            onCheckedChange={(v) => {
              if (v === settings.advanced.disableSandbox) return
              void patchSettings({
                advanced: { ...settings.advanced, disableSandbox: v },
              }).then(() => toast.info(t('toast.disableSandboxRestart')))
            }}
          />
        </SettingField>

        <SettingField
          icon={Activity}
          label={t('settings.advanced.statusBarLiveStats')}
          description={t('settings.advanced.statusBarLiveStatsDesc')}
          row
        >
          <Switch
            checked={settings.advanced.statusBarLiveStats !== false}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, statusBarLiveStats: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Droplets}
          label={t('settings.advanced.transparency', {
            value: settings.advanced.transparency,
          })}
        >
          <Slider
            className="max-w-md"
            min={70}
            max={100}
            step={1}
            value={[settings.advanced.transparency]}
            onValueChange={([v]) =>
              patchSettings({ advanced: { ...settings.advanced, transparency: v } })
            }
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
