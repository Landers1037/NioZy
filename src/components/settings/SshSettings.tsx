import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { Bell, ArrowLeftRight, Server, Search } from 'lucide-react'

export function SshSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const ssh = settings.ssh

  const checkScp = async () => {
    const result = await getElectronAPI().ssh.checkScp()
    if (result.found) {
      toast.success(t('settings.ssh.scpFound', { path: result.path ?? 'scp' }))
    } else {
      toast.error(t('settings.ssh.scpNotFound'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-5" />
          {t('settings.ssh.title')}
        </CardTitle>
        <CardDescription>{t('settings.ssh.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Bell}
          label={t('settings.ssh.alertOnDisconnect')}
          description={t('settings.ssh.alertOnDisconnectDesc')}
          row
        >
          <Switch
            checked={ssh.alertOnDisconnect}
            onCheckedChange={(v) =>
              patchSettings({ ssh: { ...ssh, alertOnDisconnect: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={ArrowLeftRight}
          label={t('settings.ssh.scpTransferEnabled')}
          description={t('settings.ssh.scpTransferEnabledDesc')}
          row
        >
          <Switch
            checked={ssh.scpTransferEnabled}
            onCheckedChange={(v) =>
              patchSettings({ ssh: { ...ssh, scpTransferEnabled: v } })
            }
          />
        </SettingField>

        <SettingField
          icon={Search}
          label={t('settings.ssh.checkScp')}
          description={t('settings.ssh.checkScpDesc')}
        >
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => void checkScp()}
          >
            {t('settings.ssh.checkScpButton')}
          </Button>
        </SettingField>
      </CardContent>
    </Card>
  )
}
