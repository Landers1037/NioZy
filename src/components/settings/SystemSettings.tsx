import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { SettingField } from './SettingField'
import { InputWithVaultPicker } from './InputWithVaultPicker'
import { useEffect, useState } from 'react'
import {
  Download,
  ExternalLink,
  Info,
  Loader2,
  Minimize2,
  Power,
  Globe,
  RefreshCw,
} from 'lucide-react'
import { GITHUB_RELEASES_URL } from '@/constants/urls'
import { getElectronAPI } from '@/lib/electron-client'
import type { UpdateCheckResult } from '../../../electron/shared/api-types'
import logoUrl from '@/logo.png'

export function SystemSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [reloadingEnv, setReloadingEnv] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [downloadingUpdate, setDownloadingUpdate] = useState(false)
  const [updateAvailableOpen, setUpdateAvailableOpen] = useState(false)
  const [upToDateOpen, setUpToDateOpen] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{
    latestVersion: string
    downloadUrl: string
  } | null>(null)
  const [appVersion, setAppVersion] = useState('…')

  useEffect(() => {
    void getElectronAPI()
      .app.getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.1.0'))
  }, [])

  if (!settings) return null

  const updateBusy = checkingUpdate || downloadingUpdate

  const handleReloadEnvironment = async () => {
    setReloadingEnv(true)
    try {
      const result = await getElectronAPI().system.reloadEnvironment()
      if (result.ok) {
        toast.success(
          t('toast.envReloadSuccess', {
            vars: result.variableCount,
            paths: result.pathSegmentCount,
          }),
        )
      } else {
        toast.error(result.error ?? t('toast.envReloadFailed'))
      }
    } catch {
      toast.error(t('toast.envReloadFailed'))
    } finally {
      setReloadingEnv(false)
    }
  }

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true)
    try {
      const result: UpdateCheckResult = await getElectronAPI().update.check()
      setAppVersion(result.currentVersion)
      if (!result.ok) {
        toast.error(result.error ?? t('toast.updateCheckFailed'))
        return
      }
      if (result.hasUpdate && result.latestVersion && result.downloadUrl) {
        setPendingUpdate({
          latestVersion: result.latestVersion,
          downloadUrl: result.downloadUrl,
        })
        setUpdateAvailableOpen(true)
      } else {
        setUpToDateOpen(true)
      }
    } catch {
      toast.error(t('toast.updateCheckFailed'))
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = async () => {
    if (!pendingUpdate) return
    setUpdateAvailableOpen(false)
    setDownloadingUpdate(true)
    try {
      const result = await getElectronAPI().update.download({
        version: pendingUpdate.latestVersion,
        downloadUrl: pendingUpdate.downloadUrl,
      })
      if (!result.ok) {
        toast.error(result.error ?? t('toast.updateDownloadFailed'))
      }
    } catch {
      toast.error(t('toast.updateDownloadFailed'))
    } finally {
      setDownloadingUpdate(false)
    }
  }

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

        <SettingField
          icon={RefreshCw}
          label={t('settings.system.reloadEnvironment')}
          description={t('settings.system.reloadEnvironmentDesc')}
        >
          <Button
            variant="secondary"
            disabled={reloadingEnv}
            className="w-fit"
            onClick={() => void handleReloadEnvironment()}
          >
            <RefreshCw className={reloadingEnv ? 'size-4 animate-spin' : 'size-4'} />
            {t('settings.system.reloadEnvironment')}
          </Button>
        </SettingField>

        <SettingField icon={Download} label={t('settings.system.updates')}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={updateBusy}
              onClick={() => void handleCheckUpdates()}
            >
              {updateBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {downloadingUpdate
                ? t('settings.system.downloadingUpdate')
                : t('settings.system.checkUpdates')}
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

        <div className="rounded-lg border border-border bg-muted p-6">
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="NioZy"
              className="mb-4 size-20 rounded-xl object-contain"
            />
            <p className="flex items-center gap-2 font-bold">
              <Info className="size-4 text-muted-foreground" />
              {t('settings.system.about')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('settings.system.version', { version: appVersion })}
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('settings.system.aboutDesc')}
            </p>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={updateAvailableOpen} onOpenChange={setUpdateAvailableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.system.updateAvailableTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.system.updateAvailableDesc', {
                current: appVersion,
                latest: pendingUpdate?.latestVersion ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={downloadingUpdate}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={downloadingUpdate}
              onClick={(e) => {
                e.preventDefault()
                void handleDownloadUpdate()
              }}
            >
              {t('settings.system.downloadAndInstall')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={upToDateOpen} onOpenChange={setUpToDateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.system.upToDateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.system.upToDateDesc', { version: appVersion })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{t('common.ok')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
