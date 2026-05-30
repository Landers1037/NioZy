import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import {
  TerminalSquare,
  Smile,
  Link2,
  MousePointerClick,
  CornerDownLeft,
  Hash,
  GripVertical,
} from 'lucide-react'
import { CommandReplaySettingsSection } from '@/components/command-replay/CommandReplaySettingsSection'

export function ShellSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const shell = settings.shell

  const patchShell = (partial: Partial<typeof shell>) =>
    patchSettings({ shell: { ...shell, ...partial } })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TerminalSquare className="size-5" />
          {t('settings.shell.title')}
        </CardTitle>
        <CardDescription>{t('settings.shell.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Smile}
          label={t('settings.shell.emojiNativeRendering')}
          description={t('settings.shell.emojiNativeRenderingDesc')}
          row
        >
          <Switch
            checked={shell.emojiNativeRendering}
            onCheckedChange={(v) => patchShell({ emojiNativeRendering: v })}
          />
        </SettingField>

        <SettingField
          icon={Link2}
          label={t('settings.shell.highlightLinks')}
          description={t('settings.shell.highlightLinksDesc')}
          row
        >
          <Switch
            checked={shell.highlightLinks}
            onCheckedChange={(v) => patchShell({ highlightLinks: v })}
          />
        </SettingField>

        <SettingField
          icon={MousePointerClick}
          label={t('settings.shell.clickToOpenLinks')}
          description={t('settings.shell.clickToOpenLinksDesc')}
          row
        >
          <Switch
            checked={shell.clickToOpenLinks}
            onCheckedChange={(v) => patchShell({ clickToOpenLinks: v })}
          />
        </SettingField>

        <SettingField
          icon={CornerDownLeft}
          label={t('settings.shell.shiftEnterNewline')}
          description={t('settings.shell.shiftEnterNewlineDesc')}
          row
        >
          <Switch
            checked={shell.shiftEnterNewline}
            onCheckedChange={(v) => patchShell({ shiftEnterNewline: v })}
          />
        </SettingField>

        <SettingField
          icon={Hash}
          label={t('settings.shell.showTerminalIndex')}
          description={t('settings.shell.showTerminalIndexDesc')}
          row
        >
          <Switch
            checked={shell.showTerminalIndex}
            onCheckedChange={(v) => patchShell({ showTerminalIndex: v })}
          />
        </SettingField>

        <SettingField
          icon={GripVertical}
          label={t('settings.shell.enableTabDrag')}
          description={t('settings.shell.enableTabDragDesc')}
          row
        >
          <Switch
            checked={shell.enableTabDrag}
            onCheckedChange={(v) => patchShell({ enableTabDrag: v })}
          />
        </SettingField>

        <CommandReplaySettingsSection />
      </CardContent>
    </Card>
  )
}
