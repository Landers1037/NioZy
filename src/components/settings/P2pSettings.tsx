import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import { MessageSquare, FolderOpen, Radio, Network, ToggleLeft } from 'lucide-react'
import { DEFAULT_P2P_PORT, normalizeP2pPort } from '../../../electron/shared/p2p-settings'

export function P2pSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [chatDirectory, setChatDirectory] = useState('')
  const [portInput, setPortInput] = useState(String(DEFAULT_P2P_PORT))

  useEffect(() => {
    void getElectronAPI()
      .p2p.getStatus()
      .then((status) => setChatDirectory(status.chatDirectory))
      .catch(() => {})
  }, [])

  if (!settings) return null

  const p2p = settings.p2p

  const patchP2p = (partial: Partial<typeof p2p>) =>
    patchSettings({ p2p: { ...p2p, ...partial } })

  const commitPort = () => {
    const port = normalizeP2pPort(Number(portInput))
    setPortInput(String(port))
    if (port !== p2p.port) {
      void patchP2p({ port }).catch(() => toast.error(t('settings.vault.saveFailed')))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          {t('settings.p2p.title')}
        </CardTitle>
        <CardDescription>{t('settings.p2p.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={ToggleLeft}
          label={t('settings.p2p.enabled')}
          description={t('settings.p2p.enabledDesc')}
          row
        >
          <Switch
            checked={p2p.enabled}
            onCheckedChange={(v) => void patchP2p({ enabled: v })}
          />
        </SettingField>

        <SettingField
          icon={Network}
          label={t('settings.p2p.port')}
          description={t('settings.p2p.portDesc')}
        >
          <Input
            className="max-w-xs"
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            disabled={!p2p.enabled}
            onChange={(e) => setPortInput(e.target.value)}
            onBlur={commitPort}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPort()
            }}
          />
        </SettingField>

        <SettingField
          icon={Radio}
          label={t('settings.p2p.discoveryEnabled')}
          description={t('settings.p2p.discoveryEnabledDesc')}
          row
        >
          <Switch
            checked={p2p.discoveryEnabled}
            disabled={!p2p.enabled}
            onCheckedChange={(v) => void patchP2p({ discoveryEnabled: v })}
          />
        </SettingField>

        <SettingField
          icon={FolderOpen}
          label={t('settings.p2p.chatDirectory')}
          description={t('settings.p2p.chatDirectoryDesc')}
        >
          <div className="flex gap-2">
            <Input className="min-w-0 flex-1" value={chatDirectory} readOnly />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void getElectronAPI()
                  .p2p.openChatDirectory()
                  .catch(() => toast.error(t('toast.openChatDirectoryFailed')))
              }
            >
              <FolderOpen className="size-4" />
              {t('settings.p2p.openChatDirectory')}
            </Button>
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
