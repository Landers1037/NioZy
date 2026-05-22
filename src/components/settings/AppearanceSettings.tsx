import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app-store'
import { FontSizeInput } from '@/components/settings/FontSizeInput'
import { SettingField } from './SettingField'
import { Languages, Moon, Palette, Type, LayoutPanelLeft } from 'lucide-react'
import { getLayoutModeOptions } from '@/lib/layout-mode'
import { cn } from '@/lib/utils'
import type { AppLocale, LayoutMode } from '../../../electron/shared/api-types'
import { APP_LOCALES } from '../../../electron/shared/locale'

const ACCENT_PRESETS = ['#0A84FF', '#0066FF', '#00D2FF', '#6366F1', '#10B981']

export function AppearanceSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const layoutOptions = getLayoutModeOptions(t)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appearance.title')}</CardTitle>
        <CardDescription>{t('settings.appearance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={LayoutPanelLeft} label={t('settings.appearance.layoutMode')}>
          <div className="flex flex-col gap-3">
            <div
              className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border bg-muted/50 p-1"
              role="tablist"
              aria-label={t('settings.appearance.layoutModeAria')}
            >
              {layoutOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={settings.layoutMode === opt.value}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    settings.layoutMode === opt.value
                      ? 'bg-background text-foreground shadow-sm dark:bg-primary/18 dark:ring-1 dark:ring-primary/35'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => patchSettings({ layoutMode: opt.value as LayoutMode })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {layoutOptions.find((o) => o.value === settings.layoutMode)?.description}
            </p>
          </div>
        </SettingField>

        <SettingField icon={Languages} label={t('settings.appearance.language')}>
          <Select
            value={settings.locale}
            onValueChange={(v) => patchSettings({ locale: v as AppLocale })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_LOCALES.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {t(`locale.${loc}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField icon={Moon} label={t('settings.appearance.themeMode')}>
          <Select
            value={settings.theme}
            onValueChange={(v) => patchSettings({ theme: v as 'light' | 'dark' })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('theme.light')}</SelectItem>
              <SelectItem value="dark">{t('theme.dark')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField icon={Palette} label={t('settings.appearance.accentColor')}>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="size-8 rounded-lg border-2 border-border transition-transform hover:scale-105"
                style={{
                  background: color,
                  borderColor: settings.accentColor === color ? color : undefined,
                }}
                onClick={() => patchSettings({ accentColor: color })}
              />
            ))}
          </div>
          <Input
            type="color"
            className="h-8 max-w-[120px] cursor-pointer p-1"
            value={settings.accentColor}
            onChange={(e) => patchSettings({ accentColor: e.target.value })}
          />
        </SettingField>

        <FontSizeInput
          icon={Type}
          label={t('settings.appearance.globalFontSize')}
          min={11}
          max={18}
          value={settings.fontSize}
          onChange={(fontSize) => patchSettings({ fontSize })}
        />
      </CardContent>
    </Card>
  )
}
