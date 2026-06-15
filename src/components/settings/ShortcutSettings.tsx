import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { SettingField } from './SettingField'
import { ShortcutInput } from './ShortcutInput'
import { useAppStore } from '@/stores/app-store'
import type { AppShortcuts } from '../../../electron/shared/api-types'
import { formatAcceleratorForDisplay, isValidGlobalAccelerator } from '@/lib/shortcut-utils'
import { Crop, Keyboard, Monitor, Terminal } from 'lucide-react'
import { toast } from 'sonner'

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
  'commandPalette',
] as const satisfies ReadonlyArray<keyof AppShortcuts['app']>

export function ShortcutSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const shortcuts = settings.shortcuts
  const screenshotEnabled = settings.assistive.screenshotEnabled !== false

  const patchApp = (key: keyof AppShortcuts['app'], value: string) => {
    patchSettings({
      shortcuts: {
        ...shortcuts,
        app: { ...shortcuts.app, [key]: value },
      },
    })
  }

  const rejectInvalidGlobalShortcut = (key: keyof AppShortcuts['global']) => {
    toast.error(t('settings.shortcuts.globalSingleKeyNotAllowed'))
    patchSettings({
      shortcuts: {
        ...shortcuts,
        global: { ...shortcuts.global, [key]: '' },
      },
    })
  }

  const patchGlobal = (key: keyof AppShortcuts['global'], value: string) => {
    patchSettings({
      shortcuts: {
        ...shortcuts,
        global: { ...shortcuts.global, [key]: value },
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
          <ShortcutInput
            className="max-w-md font-mono text-sm"
            value={shortcuts.global.showApp}
            onChange={(v) => patchGlobal('showApp', v)}
            validate={isValidGlobalAccelerator}
            onInvalid={() => rejectInvalidGlobalShortcut('showApp')}
          />
        </SettingField>

        {screenshotEnabled ? (
          <SettingField
            icon={Crop}
            label={t('settings.shortcuts.globalScreenshot')}
            description={t('settings.shortcuts.globalScreenshotDesc', {
              current: formatAcceleratorForDisplay(shortcuts.global.screenshot),
            })}
          >
            <ShortcutInput
              className="max-w-md font-mono text-sm"
              value={shortcuts.global.screenshot}
              onChange={(v) => patchGlobal('screenshot', v)}
              validate={isValidGlobalAccelerator}
              onInvalid={() => rejectInvalidGlobalShortcut('screenshot')}
            />
          </SettingField>
        ) : null}

        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Terminal className="size-4 text-muted-foreground" />
            {t('settings.shortcuts.inApp')}
          </p>
          {APP_SHORTCUT_KEYS.map((key) => (
            <SettingField key={key} icon={Keyboard} label={t(`settings.shortcuts.${key}`)}>
              <ShortcutInput
                className="max-w-md font-mono text-sm"
                value={shortcuts.app[key]}
                onChange={(v) => patchApp(key, v)}
              />
            </SettingField>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
