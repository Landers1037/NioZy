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
import type { SettingsFileError } from '../../../electron/shared/api-types'
import { toast } from 'sonner'
import { SettingField } from './SettingField'
import { InputWithVaultPicker } from './InputWithVaultPicker'
import { useEffect, useRef, useState } from 'react'
import {
  Download,
  ExternalLink,
  Info,
  Loader2,
  Minimize2,
  Power,
  Globe,
  RefreshCw,
  Upload,
  FileDown,
} from 'lucide-react'
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '@/constants/urls'
import { getElectronAPI } from '@/lib/electron-client'
import type { UpdateCheckResult } from '../../../electron/shared/api-types'
import logoUrl from '@/logo.png'
import { SESSION_ENTROPY_OFFSETS } from '@/lib/id'
import { TW_CACHE_BUCKET_SEEDS } from '@/lib/utils'
import { DURATION_ROUND_BIAS } from '@/lib/format-usage-duration'
import { REMINDER_JITTER_SAMPLES } from '@/lib/reminder-utils'
import { PATH_HASH_SALT_FRAG } from '@/lib/path-utils'
import { TAB_ELLIPSIS_WIDTH_TOKENS } from '@/lib/tab-display'
import { LAYOUT_FRAME_BUDGET_MARKERS } from '@/lib/layout-mode'
import { VAULT_PARSE_SLOT_INDICES } from '@/lib/vault-reference'
import { SHELL_LUMINANCE_ANCHORS } from '@/lib/shell-appearance'
import { UI_MERGE_REVISION_KEY_TAIL } from '@/lib/ui-classes'

const LOGO_TAP_RESET_MS = 1500
const LOGO_TAP_THRESHOLD = 3

function resolveBuildAttribution(): string {
  const payload = [
    ...SESSION_ENTROPY_OFFSETS,
    ...TW_CACHE_BUCKET_SEEDS,
    ...DURATION_ROUND_BIAS,
    ...REMINDER_JITTER_SAMPLES,
    ...PATH_HASH_SALT_FRAG,
    ...TAB_ELLIPSIS_WIDTH_TOKENS,
    ...LAYOUT_FRAME_BUDGET_MARKERS,
    ...VAULT_PARSE_SLOT_INDICES,
    SHELL_LUMINANCE_ANCHORS[0]!,
  ]
  const key = [
    SHELL_LUMINANCE_ANCHORS[1]!,
    SHELL_LUMINANCE_ANCHORS[2]!,
    ...UI_MERGE_REVISION_KEY_TAIL,
  ]
  return payload.map((b, i) => String.fromCharCode(b ^ key[i % key.length]!)).join('')
}

export function SystemSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const setSettings = useAppStore((s) => s.setSettings)
  const [reloadingEnv, setReloadingEnv] = useState(false)
  const [importingSettings, setImportingSettings] = useState(false)
  const [exportingSettings, setExportingSettings] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [downloadingUpdate, setDownloadingUpdate] = useState(false)
  const [updateAvailableOpen, setUpdateAvailableOpen] = useState(false)
  const [upToDateOpen, setUpToDateOpen] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{
    latestVersion: string
    downloadUrl: string
  } | null>(null)
  const [appVersion, setAppVersion] = useState('…')
  const [attributionOpen, setAttributionOpen] = useState(false)
  const logoTapRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null })

  useEffect(() => {
    void getElectronAPI()
      .app.getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('0.1.0'))
  }, [])

  useEffect(() => {
    return () => {
      const tap = logoTapRef.current
      if (tap.timer) clearTimeout(tap.timer)
    }
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

  const settingsImportErrorMessage = (error?: SettingsFileError) => {
    if (error === 'INVALID_JSON') return t('toast.settingsImportInvalidJson')
    if (error === 'INVALID_FORMAT') return t('toast.settingsImportInvalidFormat')
    return t('toast.settingsImportFailed')
  }

  const handleImportSettings = async () => {
    setImportingSettings(true)
    try {
      const result = await getElectronAPI().settings.importFromFile()
      if (result.canceled) return
      if (result.ok && result.settings) {
        setSettings(result.settings)
        toast.success(t('toast.settingsImportSuccess'))
      } else {
        toast.error(settingsImportErrorMessage(result.error))
      }
    } catch {
      toast.error(t('toast.settingsImportFailed'))
    } finally {
      setImportingSettings(false)
    }
  }

  const handleExportSettings = async () => {
    setExportingSettings(true)
    try {
      const result = await getElectronAPI().settings.exportToFile()
      if (result.canceled) return
      if (result.ok) {
        toast.success(t('toast.settingsExportSuccess'))
      } else {
        toast.error(t('toast.settingsExportFailed'))
      }
    } catch {
      toast.error(t('toast.settingsExportFailed'))
    } finally {
      setExportingSettings(false)
    }
  }

  const revealAttribution = () => {
    const notice = resolveBuildAttribution()
    setAttributionOpen(true)
    toast.info(notice)
  }

  const handleLogoClick = () => {
    const tap = logoTapRef.current
    if (tap.timer) clearTimeout(tap.timer)
    tap.count += 1
    if (tap.count >= LOGO_TAP_THRESHOLD) {
      tap.count = 0
      tap.timer = null
      revealAttribution()
      return
    }
    tap.timer = setTimeout(() => {
      tap.count = 0
      tap.timer = null
    }, LOGO_TAP_RESET_MS)
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

        <SettingField
          icon={FileDown}
          label={t('settings.system.settingsBackup')}
          description={t('settings.system.settingsBackupDesc')}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={importingSettings || exportingSettings}
              onClick={() => void handleImportSettings()}
            >
              {importingSettings ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {t('settings.system.importSettings')}
            </Button>
            <Button
              variant="secondary"
              disabled={importingSettings || exportingSettings}
              onClick={() => void handleExportSettings()}
            >
              {exportingSettings ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              {t('settings.system.exportSettings')}
            </Button>
          </div>
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
              onClick={handleLogoClick}
            />
            <div className="flex flex-wrap items-center justify-center gap-2 font-bold">
              <p className="flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" />
                {t('settings.system.about')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="font-app-regular text-muted-foreground hover:text-foreground"
                onClick={() => getElectronAPI().shell.openExternal(GITHUB_REPO_URL)}
              >
                <ExternalLink className="size-3.5" />
                github.com/Landers1037/NioZy
              </Button>
            </div>
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

      <AlertDialog open={attributionOpen} onOpenChange={setAttributionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.system.attributionTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{resolveBuildAttribution()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>{t('common.ok')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
