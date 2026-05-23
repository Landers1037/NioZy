import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Activity, AppWindow, Bug, Cpu, Droplets, FolderOpen, ShieldOff } from 'lucide-react'
import { getElectronAPI } from '@/lib/electron-client'

export function AdvancedSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const isWindows = getElectronAPI().system.platform === 'win32'
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

        {isWindows && (
          <SettingField
            icon={FolderOpen}
            label={t('settings.advanced.shellContextMenu')}
            description={t('settings.advanced.shellContextMenuDesc')}
            row
          >
            <Switch
              checked={settings.advanced.shellContextMenu === true}
              onCheckedChange={(v) => {
                if (v === settings.advanced.shellContextMenu) return
                void patchSettings({
                  advanced: { ...settings.advanced, shellContextMenu: v },
                }).catch(() => toast.error(t('toast.shellContextMenuFailed')))
              }}
            />
          </SettingField>
        )}

        <SettingField
          icon={AppWindow}
          label={t('settings.advanced.preserveWindowBounds')}
          description={t('settings.advanced.preserveWindowBoundsDesc')}
          row
        >
          <Switch
            checked={settings.advanced.preserveWindowBounds === true}
            onCheckedChange={(v) =>
              patchSettings({ advanced: { ...settings.advanced, preserveWindowBounds: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Bug}
          label={t('settings.advanced.debugLog')}
          description={t('settings.advanced.debugLogDesc')}
          row
        >
          <Switch
            checked={settings.advanced.debugLog === true}
            onCheckedChange={(v) =>
              void patchSettings({ advanced: { ...settings.advanced, debugLog: v } }).then(
                () => {
                  if (v) toast.info(t('toast.debugLogEnabled'))
                },
              )
            }
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
