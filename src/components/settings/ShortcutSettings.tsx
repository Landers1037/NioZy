import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SettingField } from './SettingField'
import { useAppStore } from '@/stores/app-store'
import { APP_SHORTCUT_LABELS } from '../../../electron/shared/shortcuts'
import type { AppShortcuts } from '../../../electron/shared/api-types'
import { formatAcceleratorForDisplay } from '@/lib/shortcut-utils'
import { Keyboard, Monitor, Terminal } from 'lucide-react'

export function ShortcutSettings() {
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
          快捷键
        </CardTitle>
        <CardDescription>
          使用 Electron 加速器格式，如 CommandOrControl+T、Ctrl+Shift+C
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Monitor}
          label="显示/隐藏 NioZy（全局）"
          description={`已在前台则退到后台，否则显示到前台（保持当前页面）。当前：${formatAcceleratorForDisplay(shortcuts.global.showApp)}`}
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
          <p className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4 text-muted-foreground" />
            程序内快捷键
          </p>
          {(Object.keys(APP_SHORTCUT_LABELS) as (keyof AppShortcuts['app'])[]).map(
            (key) => (
              <SettingField key={key} icon={Keyboard} label={APP_SHORTCUT_LABELS[key]}>
                <Input
                  className="max-w-md font-mono text-sm"
                  value={shortcuts.app[key]}
                  onChange={(e) => patchApp(key, e.target.value)}
                />
              </SettingField>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  )
}
