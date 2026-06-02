import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import {
  DEFAULT_ENABLED_SSH_KEX_ALGORITHMS,
  LEGACY_SSH_KEX_ALGORITHM_IDS,
  MODERN_SSH_KEX_ALGORITHM_IDS,
  type SshKexAlgorithmId,
} from '../../../electron/shared/ssh-kex-algorithms'
import type { SshSettings as SshSettingsType } from '../../../electron/shared/ssh-settings'
import { Bell, ArrowLeftRight, Server, Search, Terminal, KeyRound } from 'lucide-react'

function toggleKex(
  ssh: SshSettingsType,
  id: SshKexAlgorithmId,
  enabled: boolean,
  patchSettings: (p: { ssh: SshSettingsType }) => void,
): void {
  const current = new Set(ssh.enabledKexAlgorithms)
  if (enabled) current.add(id)
  else current.delete(id)
  const next = [...current]
  patchSettings({
    ssh: {
      ...ssh,
      enabledKexAlgorithms:
        next.length > 0 ? (next as SshKexAlgorithmId[]) : [...DEFAULT_ENABLED_SSH_KEX_ALGORITHMS],
    },
  })
}

function KexAlgorithmList({
  ssh,
  ids,
  patchSettings,
}: {
  ssh: SshSettingsType
  ids: readonly SshKexAlgorithmId[]
  patchSettings: (p: { ssh: SshSettingsType }) => void
}) {
  const enabledSet = new Set(ssh.enabledKexAlgorithms)

  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li key={id}>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border border-input accent-primary"
              checked={enabledSet.has(id)}
              onChange={(e) => toggleKex(ssh, id, e.target.checked, patchSettings)}
            />
            <span className="font-mono text-xs leading-snug break-all">{id}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

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
          icon={Terminal}
          label={t('settings.ssh.useBuiltinSsh2')}
          description={t('settings.ssh.useBuiltinSsh2Desc')}
          row
        >
          <Switch
            checked={ssh.useBuiltinSsh2}
            onCheckedChange={(v) => patchSettings({ ssh: { ...ssh, useBuiltinSsh2: v } })}
          />
        </SettingField>

        <SettingField
          icon={KeyRound}
          label={t('settings.ssh.kexAlgorithms')}
          description={t('settings.ssh.kexAlgorithmsDesc')}
        >
          <div className="max-w-xl space-y-4 rounded-md border border-border p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('settings.ssh.kexModern')}
              </p>
              <KexAlgorithmList
                ssh={ssh}
                ids={MODERN_SSH_KEX_ALGORITHM_IDS}
                patchSettings={patchSettings}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('settings.ssh.kexLegacy')}
              </p>
              <KexAlgorithmList
                ssh={ssh}
                ids={LEGACY_SSH_KEX_ALGORITHM_IDS}
                patchSettings={patchSettings}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patchSettings({
                  ssh: {
                    ...ssh,
                    enabledKexAlgorithms: [...DEFAULT_ENABLED_SSH_KEX_ALGORITHMS],
                  },
                })
              }
            >
              {t('settings.ssh.kexResetDefaults')}
            </Button>
          </div>
        </SettingField>

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
