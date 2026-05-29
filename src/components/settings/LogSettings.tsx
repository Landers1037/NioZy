import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { FileText, FolderOpen, ScrollText, ToggleLeft } from 'lucide-react'
import { getElectronAPI } from '@/lib/electron-client'
import { LOG_LEVELS, type LogLevel } from '../../../electron/shared/logging-settings'

export function LogSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const logging = settings.logging

  const patchLogging = (partial: Partial<typeof logging>) =>
    patchSettings({ logging: { ...logging, ...partial } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-5" />
          {t('settings.logging.title')}
        </CardTitle>
        <CardDescription>{t('settings.logging.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={ToggleLeft}
          label={t('settings.logging.enabled')}
          description={t('settings.logging.enabledDesc')}
          row
        >
          <Switch
            checked={logging.enabled === true}
            onCheckedChange={(v) =>
              void patchLogging({ enabled: v }).then(() => {
                if (v) toast.info(t('toast.loggingEnabled'))
              })
            }
          />
        </SettingField>

        <SettingField
          icon={FileText}
          label={t('settings.logging.level')}
          description={t('settings.logging.levelDesc')}
        >
          <Select
            value={logging.level}
            disabled={!logging.enabled}
            onValueChange={(v) => patchLogging({ level: v as LogLevel })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField
          icon={FolderOpen}
          label={t('settings.logging.filePath')}
          description={t('settings.logging.filePathDesc')}
        >
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              value={logging.filePath}
              disabled={!logging.enabled}
              onChange={(e) => patchLogging({ filePath: e.target.value })}
              placeholder={t('settings.logging.filePathPlaceholder')}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!logging.enabled}
              onClick={() =>
                void getElectronAPI()
                  .logging.openLogDirectory()
                  .catch(() => toast.error(t('toast.openLogDirectoryFailed')))
              }
            >
              <FolderOpen className="size-4" />
              {t('settings.logging.openLogDirectory')}
            </Button>
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
