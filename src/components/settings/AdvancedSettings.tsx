import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { relaunchApp } from '@/lib/app-relaunch'
import { SettingField } from './SettingField'
import { Activity, AppWindow, Cpu, Droplets, FolderOpen, ShieldOff } from 'lucide-react'
import { GpuIcon } from '@/components/icons/GpuIcon'
import { getElectronAPI } from '@/lib/electron-client'

const WINDOW_TRANSPARENCY_MIN = 70
const WINDOW_TRANSPARENCY_MAX = 100

function notifyWebGpuRestartRequired(t: (key: string) => string) {
  toast.info(t('toast.webGpuAccelerationRestart'), {
    duration: 10_000,
    action: {
      label: t('toast.restartApp'),
      onClick: () => relaunchApp(),
    },
  })
}

export function AdvancedSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const isWindows = getElectronAPI().system.platform === 'win32'
  const savedTransparency = settings?.advanced.transparency ?? WINDOW_TRANSPARENCY_MAX
  const [draftTransparency, setDraftTransparency] = useState(savedTransparency)
  const previewRafRef = useRef<number | null>(null)
  const pendingPreviewRef = useRef<number | null>(null)

  useEffect(() => {
    setDraftTransparency(savedTransparency)
  }, [savedTransparency])

  const flushTransparencyPreview = useCallback((value: number) => {
    pendingPreviewRef.current = null
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current)
      previewRafRef.current = null
    }
    getElectronAPI().window.setTransparencyPreview(value)
  }, [])

  const scheduleTransparencyPreview = useCallback(
    (value: number) => {
      pendingPreviewRef.current = value
      if (previewRafRef.current !== null) return
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = null
        const pending = pendingPreviewRef.current
        if (pending !== null) getElectronAPI().window.setTransparencyPreview(pending)
      })
    },
    [],
  )

  useEffect(
    () => () => {
      if (previewRafRef.current !== null) cancelAnimationFrame(previewRafRef.current)
      const current = useAppStore.getState().settings?.advanced.transparency
      if (current !== undefined) getElectronAPI().window.setTransparencyPreview(current)
    },
    [],
  )

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
                advanced: {
                  ...settings.advanced,
                  hardwareAcceleration: v,
                  webGpuAcceleration: v ? settings.advanced.webGpuAcceleration : false,
                },
              }).then(() => toast.info(t('toast.hardwareAccelerationRestart')))
            }}
          />
        </SettingField>

        <SettingField
          icon={GpuIcon}
          label={t('settings.advanced.webGpuAcceleration')}
          description={t('settings.advanced.webGpuAccelerationDesc')}
          row
        >
          <Switch
            checked={settings.advanced.webGpuAcceleration === true}
            disabled={!settings.advanced.hardwareAcceleration}
            onCheckedChange={(v) => {
              if (v === settings.advanced.webGpuAcceleration) return
              void patchSettings({
                advanced: {
                  ...settings.advanced,
                  hardwareAcceleration: true,
                  webGpuAcceleration: v,
                },
              }).then(() => notifyWebGpuRestartRequired(t))
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
            value: draftTransparency,
          })}
        >
          <Slider
            className="max-w-md"
            min={WINDOW_TRANSPARENCY_MIN}
            max={WINDOW_TRANSPARENCY_MAX}
            step={1}
            value={[draftTransparency]}
            onValueChange={([v]) => {
              setDraftTransparency(v)
              scheduleTransparencyPreview(v)
            }}
            onValueCommit={([v]) => {
              flushTransparencyPreview(v)
              if (v === savedTransparency) return
              void patchSettings({ advanced: { ...settings.advanced, transparency: v } })
            }}
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
