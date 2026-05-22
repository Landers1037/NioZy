import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FontFamilyPicker } from '@/components/settings/FontFamilyPicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { COLOR_SCHEME_OPTIONS } from '@/lib/terminal-themes'
import { getCursorStyleOptions } from '@/lib/terminal-cursor'
import { ColorSchemePreview } from '@/components/settings/ColorSchemePreview'
import { FontSizeInput } from '@/components/settings/FontSizeInput'
import { SettingField } from './SettingField'
import { cn } from '@/lib/utils'
import type { TerminalColorScheme, TerminalCursorStyle } from '../../../electron/shared/api-types'
import { Cpu, Palette, TextCursor, Type } from 'lucide-react'

export function TerminalSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const scheme = settings.terminal.colorScheme
  const cursorOptions = getCursorStyleOptions(t)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.terminal.title')}</CardTitle>
        <CardDescription>{t('settings.terminal.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={Palette} label={t('settings.terminal.colorScheme')}>
          <Select
            value={scheme}
            onValueChange={(v) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  colorScheme: v as TerminalColorScheme,
                },
              })
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {COLOR_SCHEME_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ColorSchemePreview schemeId={scheme} />
        </SettingField>

        <SettingField icon={Type} label={t('settings.terminal.fontFamily')}>
          <FontFamilyPicker
            value={settings.terminal.fontFamily}
            onChange={(fontFamily) =>
              patchSettings({ terminal: { ...settings.terminal, fontFamily } })
            }
          />
        </SettingField>

        <FontSizeInput
          icon={Type}
          label={t('settings.terminal.fontSize')}
          min={10}
          max={24}
          value={settings.terminal.fontSize}
          onChange={(fontSize) =>
            patchSettings({ terminal: { ...settings.terminal, fontSize } })
          }
        />

        <SettingField icon={TextCursor} label={t('settings.terminal.cursorStyle')}>
          <div
            className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border bg-muted/50 p-1"
            role="tablist"
            aria-label={t('settings.terminal.cursorStyleAria')}
          >
            {cursorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={settings.terminal.cursorStyle === opt.value}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  settings.terminal.cursorStyle === opt.value
                    ? 'bg-background text-foreground shadow-sm dark:bg-primary/18 dark:ring-1 dark:ring-primary/35'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() =>
                  patchSettings({
                    terminal: {
                      ...settings.terminal,
                      cursorStyle: opt.value as TerminalCursorStyle,
                    },
                  })
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingField>

        <SettingField
          icon={TextCursor}
          label={t('settings.terminal.cursorBlink')}
          description={t('settings.terminal.cursorBlinkDesc')}
          row
        >
          <Switch
            checked={settings.terminal.cursorBlink}
            onCheckedChange={(cursorBlink) =>
              patchSettings({ terminal: { ...settings.terminal, cursorBlink } })
            }
          />
        </SettingField>

        <SettingField
          icon={Cpu}
          label={t('settings.terminal.renderer')}
          description={t('settings.terminal.rendererDesc')}
        >
          <Select
            value={settings.terminal.renderer}
            onValueChange={(v) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  renderer: v as typeof settings.terminal.renderer,
                },
              })
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dom">{t('settings.terminal.rendererDom')}</SelectItem>
              <SelectItem value="webgl">{t('settings.terminal.rendererWebgl')}</SelectItem>
              <SelectItem value="webgpu">{t('settings.terminal.rendererWebgpu')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>
      </CardContent>
    </Card>
  )
}
