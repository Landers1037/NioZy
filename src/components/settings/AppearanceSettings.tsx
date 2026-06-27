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
import { relaunchApp } from '@/lib/app-relaunch'
import { toast } from 'sonner'
import { getElectronAPI } from '@/lib/electron-client'
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
  Bold,
  Layers2,
  ALargeSmall,
  PanelRight,
  MonitorSmartphone,
  ScrollText,
} from 'lucide-react'
import { getLayoutModeOptions } from '@/lib/layout-mode'
import { getUiStyleOptions } from '@/lib/ui-style-options'
import { cn } from '@/lib/utils'
import { getAccentPresets, getUiStyle, useUiClasses } from '@/lib/ui-style'
import type {
  AppLocale,
  LayoutMode,
  UiStyle,
  WindowsNativeEffect,
} from '../../../electron/shared/api-types'
import {
  WINDOWS_NATIVE_EFFECT_INTENSITY_MIN,
  WINDOWS_NATIVE_EFFECT_INTENSITY_MAX,
} from '../../../electron/shared/api-types'
import { APP_LOCALES } from '../../../electron/shared/locale'
import { FontWeightFields } from '@/components/settings/FontWeightInput'

export function AppearanceSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const ui = useUiClasses()
  const isWindows = getElectronAPI().system.platform === 'win32'
  if (!settings) return null

  const layoutOptions = getLayoutModeOptions(t)
  const uiStyleOptions = getUiStyleOptions(t)
  const accentPresets = getAccentPresets(getUiStyle(settings))
  const nativeEffectOptions: { value: WindowsNativeEffect; label: string }[] = [
    { value: 'acrylic', label: t('settings.appearance.windowsNativeEffectAcrylic') },
    { value: 'mica', label: t('settings.appearance.windowsNativeEffectMica') },
  ]

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
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
                  )}
                  onClick={() => {
                    const nextStyle = opt.value as UiStyle
                    if (nextStyle === settings.uiStyle) return
                    patchSettings({
                      uiStyle: nextStyle,
                      accentColor: getAccentPresets(nextStyle)[0],
                    })
                  }}
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
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
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

        <SettingField
          icon={Layers2}
          label={t('settings.appearance.enableGlassTransparency')}
          description={t('settings.appearance.enableGlassTransparencyDesc')}
          row
        >
          <Switch
            checked={settings.enableGlassTransparency}
            disabled={settings.uiStyle !== 'glass'}
            onCheckedChange={(enableGlassTransparency) =>
              patchSettings(
                enableGlassTransparency
                  ? { enableGlassTransparency: true, enableWindowsNativeEffect: false }
                  : { enableGlassTransparency: false },
              )
            }
          />
        </SettingField>

        <SettingField
          icon={MonitorSmartphone}
          label={t('settings.appearance.enableWindowsNativeEffect')}
          description={t('settings.appearance.enableWindowsNativeEffectDesc')}
          row
        >
          <Switch
            checked={settings.enableWindowsNativeEffect}
            disabled={!isWindows}
            onCheckedChange={(enableWindowsNativeEffect) =>
              patchSettings(
                enableWindowsNativeEffect
                  ? { enableWindowsNativeEffect: true, enableGlassTransparency: false }
                  : { enableWindowsNativeEffect: false },
              )
            }
          />
        </SettingField>

        {settings.enableWindowsNativeEffect === true && (
          <SettingField
            icon={Layers2}
            label={t('settings.appearance.windowsNativeEffect')}
          >
            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
              )}
              role="tablist"
              aria-label={t('settings.appearance.windowsNativeEffectAria')}
            >
              {nativeEffectOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={settings.windowsNativeEffect === opt.value}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    settings.windowsNativeEffect === opt.value
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
                  )}
                  onClick={() => patchSettings({ windowsNativeEffect: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingField>
        )}

        {settings.enableWindowsNativeEffect === true && (
          <SettingField
            icon={Layers2}
            label={t('settings.appearance.windowsNativeEffectIntensity')}
            description={t('settings.appearance.windowsNativeEffectIntensityDesc')}
          >
            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
              )}
              role="tablist"
              aria-label={t('settings.appearance.windowsNativeEffectIntensityAria')}
            >
              {Array.from(
                { length: WINDOWS_NATIVE_EFFECT_INTENSITY_MAX - WINDOWS_NATIVE_EFFECT_INTENSITY_MIN + 1 },
                (_, i) => WINDOWS_NATIVE_EFFECT_INTENSITY_MIN + i,
              ).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={settings.windowsNativeEffectIntensity === level}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    settings.windowsNativeEffectIntensity === level
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
                  )}
                  onClick={() => patchSettings({ windowsNativeEffectIntensity: level })}
                >
                  {t(`settings.appearance.windowsNativeEffectIntensityLevel${level}`)}
                </button>
              ))}
            </div>
          </SettingField>
        )}

        <SettingField
          icon={ALargeSmall}
          label={t('settings.appearance.enableSmoothFonts')}
          description={t('settings.appearance.enableSmoothFontsDesc')}
          row
        >
          <Switch
            checked={settings.enableSmoothFonts}
            onCheckedChange={(enableSmoothFonts) => {
              if (enableSmoothFonts === settings.enableSmoothFonts) return
              void patchSettings({ enableSmoothFonts }).then(() =>
                toast.info(t('toast.smoothFontsRestart'), {
                  duration: 10_000,
                  action: {
                    label: t('toast.restartApp'),
                    onClick: () => relaunchApp(),
                  },
                }),
              )
            }}
          />
        </SettingField>

        <SettingField
          icon={ScrollText}
          label={t('settings.appearance.enableSmoothScrolling')}
          description={t('settings.appearance.enableSmoothScrollingDesc')}
          row
        >
          <Switch
            checked={settings.enableSmoothScrolling}
            onCheckedChange={(enableSmoothScrolling) => {
              if (enableSmoothScrolling === settings.enableSmoothScrolling) return
              void patchSettings({ enableSmoothScrolling }).then(() =>
                toast.info(t('toast.smoothScrollingRestart'), {
                  duration: 10_000,
                  action: {
                    label: t('toast.restartApp'),
                    onClick: () => relaunchApp(),
                  },
                }),
              )
            }}
          />
        </SettingField>

        <SettingField
          icon={PanelRight}
          label={t('settings.appearance.enableStatusPanel')}
          description={t('settings.appearance.enableStatusPanelDesc')}
          row
        >
          <Switch
            checked={settings.enableStatusPanel === true}
            onCheckedChange={(enableStatusPanel) => patchSettings({ enableStatusPanel })}
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

        <FontWeightFields
          icon={Bold}
          regularLabel={t('settings.appearance.fontWeight')}
          boldLabel={t('settings.appearance.fontWeightBold')}
          regularValue={settings.fontWeight}
          boldValue={settings.fontWeightBold}
          onRegularChange={(fontWeight) => patchSettings({ fontWeight })}
          onBoldChange={(fontWeightBold) => patchSettings({ fontWeightBold })}
        />
      </CardContent>
    </Card>
  )
}
