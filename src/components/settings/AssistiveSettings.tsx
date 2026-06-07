import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import {
  Accessibility,
  Timer,
  Command,
  Search,
  Cable,
  Crop,
  NotebookPen,
} from 'lucide-react'

export function AssistiveSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const assistive = settings.assistive
  const patchAssistive = (partial: Partial<typeof assistive>) =>
    patchSettings({ assistive: { ...assistive, ...partial } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Accessibility className="size-5" />
          {t('settings.assistive.title')}
        </CardTitle>
        <CardDescription>{t('settings.assistive.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Timer}
          label={t('settings.assistive.pomodoroEnabled')}
          description={t('settings.assistive.pomodoroEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.pomodoroEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ pomodoroEnabled: v })}
          />
        </SettingField>

        <SettingField
          icon={Command}
          label={t('settings.assistive.commandReplayEnabled')}
          description={t('settings.assistive.commandReplayEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.commandReplayEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ commandReplayEnabled: v })}
          />
        </SettingField>

        <SettingField
          icon={Search}
          label={t('settings.assistive.terminalSearchEnabled')}
          description={t('settings.assistive.terminalSearchEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.terminalSearchEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ terminalSearchEnabled: v })}
          />
        </SettingField>

        <SettingField
          icon={Cable}
          label={t('settings.assistive.connectivityCheckEnabled')}
          description={t('settings.assistive.connectivityCheckEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.connectivityCheckEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ connectivityCheckEnabled: v })}
          />
        </SettingField>

        <SettingField
          icon={Crop}
          label={t('settings.assistive.screenshotEnabled')}
          description={t('settings.assistive.screenshotEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.screenshotEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ screenshotEnabled: v })}
          />
        </SettingField>

        {assistive.screenshotEnabled !== false ? (
          <div className="flex flex-col gap-6 pl-0 sm:pl-8">
            <SettingField
              icon={Crop}
              label={t('settings.assistive.screenshotHideSelf')}
              description={t('settings.assistive.screenshotHideSelfDesc')}
              row
            >
              <Switch
                checked={assistive.screenshotHideSelf === true}
                onCheckedChange={(v) => patchAssistive({ screenshotHideSelf: v })}
              />
            </SettingField>
          </div>
        ) : null}

        <SettingField
          icon={NotebookPen}
          label={t('settings.assistive.notesEnabled')}
          description={t('settings.assistive.notesEnabledDesc')}
          row
        >
          <Switch
            checked={assistive.notesEnabled !== false}
            onCheckedChange={(v) => patchAssistive({ notesEnabled: v })}
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}

