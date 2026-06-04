import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  BellRing,
  ImageIcon,
  MessageSquare,
  Timer,
  ToggleLeft,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'

export function ReminderSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [clearing, setClearing] = useState(false)

  const refreshPreview = useCallback(async () => {
    const ext = settings?.reminder.customImageExt
    if (!ext) {
      setPreviewUrl(null)
      return
    }
    const res = await getElectronAPI().reminder.getImageUrl()
    setPreviewUrl(res.ok ? res.url : null)
  }, [settings?.reminder.customImageExt])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  if (!settings) return null

  const reminder = settings.reminder
  const enabled = reminder.enabled
  const isToastMode = reminder.notifyMode === 'toast'

  const patchReminder = (partial: Partial<typeof reminder>) =>
    patchSettings({ reminder: { ...reminder, ...partial } })

  const handlePickImage = async () => {
    setPicking(true)
    try {
      const res = await getElectronAPI().reminder.pickImage()
      if (!res.ok) {
        if (res.canceled) return
        if (res.error === 'NOT_IMAGE') {
          toast.error(t('settings.reminder.imagePickNotImage'))
          return
        }
        toast.error(t('settings.reminder.imagePickFailed'))
        return
      }
      patchReminder({ customImageExt: res.ext })
      setPreviewUrl(res.url)
    } finally {
      setPicking(false)
    }
  }

  const handleClearImage = async () => {
    setClearing(true)
    try {
      const res = await getElectronAPI().reminder.clearImage()
      if (!res.ok) {
        toast.error(t('settings.reminder.imageClearFailed'))
        return
      }
      patchReminder({ customImageExt: null })
      setPreviewUrl(null)
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5" />
          {t('settings.reminder.title')}
        </CardTitle>
        <CardDescription>{t('settings.reminder.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={ToggleLeft}
          label={t('settings.reminder.enabled')}
          description={t('settings.reminder.enabledDesc')}
          row
        >
          <Switch
            checked={reminder.enabled}
            onCheckedChange={(next) => patchReminder({ enabled: next })}
          />
        </SettingField>

        <SettingField
          icon={BellRing}
          label={t('settings.reminder.systemNotification')}
          description={t('settings.reminder.systemNotificationDesc')}
          row
        >
          <Switch
            checked={reminder.systemNotification}
            disabled={!enabled}
            onCheckedChange={(next) => patchReminder({ systemNotification: next })}
          />
        </SettingField>

        <SettingField
          icon={MessageSquare}
          label={t('settings.reminder.notifyMode')}
          description={t('settings.reminder.notifyModeDesc')}
        >
          <Select
            value={reminder.notifyMode}
            disabled={!enabled}
            onValueChange={(value: 'toast' | 'dialog') => patchReminder({ notifyMode: value })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toast">{t('settings.reminder.notifyModeToast')}</SelectItem>
              <SelectItem value="dialog">{t('settings.reminder.notifyModeDialog')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField
          icon={Volume2}
          label={t('settings.reminder.soundEnabled')}
          description={t('settings.reminder.soundEnabledDesc')}
          row
        >
          <Switch
            checked={reminder.soundEnabled}
            disabled={!enabled}
            onCheckedChange={(next) => patchReminder({ soundEnabled: next })}
          />
        </SettingField>

        <SettingField
          icon={Timer}
          label={t('settings.reminder.toastDurationSec')}
          description={t('settings.reminder.toastDurationSecDesc')}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={300}
              step={1}
              className="max-w-[88px]"
              disabled={!enabled || !isToastMode}
              value={reminder.toastDurationSec}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) {
                  patchReminder({ toastDurationSec: Math.min(300, Math.max(1, n)) })
                }
              }}
            />
            <span className="text-sm text-muted-foreground">s</span>
          </div>
        </SettingField>

        <SettingField
          icon={ImageIcon}
          label={t('settings.reminder.customImage')}
          description={t('settings.reminder.customImageDesc')}
        >
          <div className="flex flex-col gap-3">
            {previewUrl ? (
              <div className="flex max-w-xs items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
                <img
                  src={previewUrl}
                  alt=""
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="w-fit"
                disabled={!enabled || picking}
                onClick={() => void handlePickImage()}
              >
                {t('settings.reminder.customImagePick')}
              </Button>
              <Button
                variant="outline"
                className="w-fit"
                disabled={!enabled || !reminder.customImageExt || clearing}
                onClick={() => void handleClearImage()}
              >
                {t('settings.reminder.customImageClear')}
              </Button>
            </div>
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
