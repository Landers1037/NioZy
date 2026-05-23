import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import {
  Languages,
  Moon,
  Palette,
  Type,
  LayoutPanelLeft,
  Sparkles,
  AppWindow,
  Wand2,
} from 'lucide-react'
import { getLayoutModeOptions } from '@/lib/layout-mode'
import { getUiStyleOptions } from '@/lib/ui-style-options'
import { cn } from '@/lib/utils'
import { getAccentPresets, getUiStyle, useUiClasses } from '@/lib/ui-style'
import type { AppLocale, LayoutMode, UiStyle } from '../../../electron/shared/api-types'
import { APP_LOCALES } from '../../../electron/shared/locale'

export function AppearanceSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const ui = useUiClasses()
  if (!settings) return null

  const layoutOptions = getLayoutModeOptions(t)
  const uiStyleOptions = getUiStyleOptions(t)
  const accentPresets = getAccentPresets(getUiStyle(settings))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appearance.title')}</CardTitle>
        <CardDescription>{t('settings.appearance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField icon={Sparkles} label={t('settings.appearance.uiStyle')}>
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
              )}
              role="tablist"
              aria-label={t('settings.appearance.uiStyleAria')}
            >
              {uiStyleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={settings.uiStyle === opt.value}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    settings.uiStyle === opt.value
                      ? ui.segmentActive
                      : ui.segmentInactive,
                  )}
                  onClick={() => patchSettings({ uiStyle: opt.value as UiStyle })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {uiStyleOptions.find((o) => o.value === settings.uiStyle)?.description}
            </p>
          </div>
        </SettingField>

        <SettingField icon={LayoutPanelLeft} label={t('settings.appearance.layoutMode')}>
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
              )}
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
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    settings.layoutMode === opt.value
                      ? ui.segmentActive
                      : ui.segmentInactive,
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

        <SettingField
          icon={AppWindow}
          label={t('settings.appearance.showAppTitle')}
          description={t('settings.appearance.showAppTitleDesc')}
          row
        >
          <Switch
            checked={settings.showAppTitle}
            onCheckedChange={(showAppTitle) => patchSettings({ showAppTitle })}
          />
        </SettingField>

        <SettingField
          icon={Wand2}
          label={t('settings.appearance.enableDialogAnimations')}
          description={t('settings.appearance.enableDialogAnimationsDesc')}
          row
        >
          <Switch
            checked={settings.enableDialogAnimations}
            onCheckedChange={(enableDialogAnimations) =>
              patchSettings({ enableDialogAnimations })
            }
          />
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
            {accentPresets.map((color) => (
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
