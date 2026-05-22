import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { SettingField } from './SettingField'
import { useAppStore } from '@/stores/app-store'
import type { AppShortcuts } from '../../../electron/shared/api-types'
import { formatAcceleratorForDisplay } from '@/lib/shortcut-utils'
import { Keyboard, Monitor, Terminal } from 'lucide-react'

const APP_SHORTCUT_KEYS = [
  'copyToClipboard',
  'pasteFromClipboard',
  'lineStart',
  'lineEnd',
  'clearTerminal',
  'newTerminal',
  'openSettings',
  'prevTerminalTab',
  'nextTerminalTab',
] as const satisfies ReadonlyArray<keyof AppShortcuts['app']>

export function ShortcutSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const shortcuts = settings.shortcuts

  const patchApp = (key: keyof AppShortcuts['app'], value: string) => {
    patchSettings({
      shortcuts: {
        ...shortcuts,
        app: { ...shortcuts.app, [key]: value },
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="size-5" />
          {t('settings.shortcuts.title')}
        </CardTitle>
        <CardDescription>{t('settings.shortcuts.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Monitor}
          label={t('settings.shortcuts.globalShowApp')}
          description={t('settings.shortcuts.globalShowAppDesc', {
            current: formatAcceleratorForDisplay(shortcuts.global.showApp),
          })}
        >
          <Input
            className="max-w-md font-mono text-sm"
            value={shortcuts.global.showApp}
            onChange={(e) =>
              patchSettings({
                shortcuts: {
                  ...shortcuts,
                  global: { showApp: e.target.value },
                },
              })
            }
          />
        </SettingField>

        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Terminal className="size-4 text-muted-foreground" />
            {t('settings.shortcuts.inApp')}
          </p>
          {APP_SHORTCUT_KEYS.map((key) => (
            <SettingField key={key} icon={Keyboard} label={t(`settings.shortcuts.${key}`)}>
              <Input
                className="max-w-md font-mono text-sm"
                value={shortcuts.app[key]}
                onChange={(e) => patchApp(key, e.target.value)}
              />
            </SettingField>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
