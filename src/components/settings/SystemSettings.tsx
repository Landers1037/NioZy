import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { SettingField } from './SettingField'
import { InputWithVaultPicker } from './InputWithVaultPicker'
import { Download, ExternalLink, Info, Minimize2, Power, Globe } from 'lucide-react'
import { GITHUB_RELEASES_URL } from '@/constants/urls'
import { getElectronAPI } from '@/lib/electron-client'
import logoUrl from '@/logo.png'

export function SystemSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.system.title')}</CardTitle>
        <CardDescription>{t('settings.system.cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={Globe} label={t('settings.system.proxy')}>
          <InputWithVaultPicker
            placeholder="http://127.0.0.1:7890"
            value={settings.system.proxy}
            onChange={(proxy) =>
              patchSettings({ system: { ...settings.system, proxy } })
            }
          />
        </SettingField>

        <SettingField
          icon={Power}
          label={t('settings.system.launchOnStartup')}
          description={t('settings.system.launchOnStartupDesc')}
          row
        >
          <Switch
            checked={settings.system.launchOnStartup}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, launchOnStartup: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Minimize2}
          label={t('settings.system.minimizeToTray')}
          description={t('settings.system.minimizeToTrayDesc')}
          row
        >
          <Switch
            checked={settings.system.minimizeToTrayOnClose}
            onCheckedChange={(v) =>
              patchSettings({ system: { ...settings.system, minimizeToTrayOnClose: v } })
            }
          />
        </SettingField>

        <SettingField icon={Download} label={t('settings.system.updates')}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => toast.info(t('settings.system.checkUpdatesSoon'))}
            >
              {t('settings.system.checkUpdates')}
            </Button>
            <Button
              variant="outline"
              onClick={() => getElectronAPI().shell.openExternal(GITHUB_RELEASES_URL)}
            >
              <ExternalLink className="size-4" />
              {t('settings.system.manualUpdate')}
            </Button>
          </div>
        </SettingField>

        <div className="rounded-lg border border-border bg-muted/50 p-6">
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="NioZy"
              className="mb-4 size-20 rounded-xl object-contain"
            />
            <p className="flex items-center gap-2 font-medium">
              <Info className="size-4 text-muted-foreground" />
              {t('settings.system.about')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('settings.system.version', { version: '0.1.0' })}
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('settings.system.aboutDesc')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
