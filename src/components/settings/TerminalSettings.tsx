import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BuiltinTerminalFontPicker } from '@/components/settings/BuiltinTerminalFontPicker'
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
import { TerminalBackgroundSettings } from '@/components/settings/TerminalBackgroundSettings'
import { FontSizeInput } from '@/components/settings/FontSizeInput'
import { FontWeightFields } from '@/components/settings/FontWeightInput'
import { SettingField } from './SettingField'
import { cn } from '@/lib/utils'
import { useUiClasses } from '@/lib/ui-style'
import type { TerminalColorScheme, TerminalCursorStyle } from '../../../electron/shared/api-types'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_TERMINAL_SCROLLBACK,
  MAX_TERMINAL_SCROLLBACK,
  MIN_TERMINAL_SCROLLBACK,
  normalizeTerminalScrollback,
} from '../../../electron/shared/terminal-xterm'
import { Bold, Cpu, Home, Layers, MousePointer2, Palette, ScrollText, Sparkles, TextCursor, Type } from 'lucide-react'
import { isDomOnlyTerminalEmulator } from '@/lib/terminal-emulator'
import type { TerminalIdleAnimationMode } from '../../../electron/shared/terminal-idle-animation'
import {
  DEFAULT_TERMINAL_IDLE_DELAY_MS,
  MAX_TERMINAL_IDLE_DELAY_MS,
  MIN_TERMINAL_IDLE_DELAY_MS,
  normalizeTerminalIdleDelayMs,
} from '../../../electron/shared/terminal-idle-animation'
import type { WelcomePageAnimationMode } from '../../../electron/shared/welcome-page-settings'
import {
  DEFAULT_WELCOME_PAGE_SETTINGS,
  WELCOME_PAGE_ANIMATION_MODES,
} from '../../../electron/shared/welcome-page-settings'

export function TerminalSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const ui = useUiClasses()
  if (!settings) return null

  const scheme = settings.terminal.colorScheme
  const cursorOptions = getCursorStyleOptions(t)
  const domOnlyEmulator = isDomOnlyTerminalEmulator(settings)
  const idleAnimation = settings.terminal.idleAnimation
  const welcomePage = settings.terminal.welcomePage ?? DEFAULT_WELCOME_PAGE_SETTINGS
  const idleAnimationModes: TerminalIdleAnimationMode[] = [
    'blackHole',
    'blackHole2',
    'pacman',
    'logo',
    'niozy',
    'ascii',
  ]

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

        <TerminalBackgroundSettings />

        <SettingField icon={Type} label={t('settings.terminal.fontFamily')}>
          <div className="flex flex-wrap items-center gap-2">
            <FontFamilyPicker
              value={settings.terminal.fontFamily}
              onChange={(fontFamily) =>
                patchSettings({ terminal: { ...settings.terminal, fontFamily } })
              }
              className={cn(settings.terminal.useBuiltinFont && 'pointer-events-none opacity-50')}
            />
            <BuiltinTerminalFontPicker
              value={settings.terminal.builtinFont}
              onChange={(builtinFont) =>
                patchSettings({ terminal: { ...settings.terminal, builtinFont } })
              }
            />
          </div>
        </SettingField>

        <SettingField
          icon={Type}
          label={t('settings.terminal.useBuiltinFont')}
          description={t('settings.terminal.useBuiltinFontDesc')}
          row
        >
          <Switch
            checked={settings.terminal.useBuiltinFont}
            onCheckedChange={(useBuiltinFont) =>
              patchSettings({ terminal: { ...settings.terminal, useBuiltinFont } })
            }
          />
        </SettingField>

        <FontWeightFields
          icon={Type}
          regularLabel={t('settings.terminal.fontWeight')}
          boldLabel={t('settings.terminal.fontWeightBold')}
          regularValue={settings.terminal.fontWeight}
          boldValue={settings.terminal.fontWeightBold}
          onRegularChange={(fontWeight) =>
            patchSettings({ terminal: { ...settings.terminal, fontWeight } })
          }
          onBoldChange={(fontWeightBold) =>
            patchSettings({ terminal: { ...settings.terminal, fontWeightBold } })
          }
        />

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

        <SettingField
          icon={Type}
          label={t('settings.terminal.ligatures')}
          description={
            domOnlyEmulator
              ? t('settings.terminal.ligaturesWtermDesc')
              : t('settings.terminal.ligaturesDesc')
          }
          row
        >
          <Switch
            checked={settings.terminal.ligaturesEnabled}
            disabled={domOnlyEmulator}
            onCheckedChange={(ligaturesEnabled) =>
              patchSettings({ terminal: { ...settings.terminal, ligaturesEnabled } })
            }
          />
        </SettingField>

        <SettingField icon={TextCursor} label={t('settings.terminal.cursorStyle')}>
          <div
            className={cn(
              'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
              ui.segmentGroupBg,
            )}
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
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  settings.terminal.cursorStyle === opt.value
                    ? cn(ui.segmentActive, 'font-app-bold')
                    : cn(ui.segmentInactive, 'font-app-regular'),
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
          icon={TextCursor}
          label={t('settings.terminal.hideCursor')}
          description={t('settings.terminal.hideCursorDesc')}
          row
        >
          <Switch
            checked={settings.terminal.hideCursor}
            onCheckedChange={(hideCursor) =>
              patchSettings({ terminal: { ...settings.terminal, hideCursor } })
            }
          />
        </SettingField>

        <SettingField
          icon={ScrollText}
          label={t('settings.terminal.scrollback')}
          description={t('settings.terminal.scrollbackDesc')}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={MIN_TERMINAL_SCROLLBACK}
              max={MAX_TERMINAL_SCROLLBACK}
              step={1000}
              className="max-w-[120px]"
              value={settings.terminal.scrollback}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) {
                  patchSettings({
                    terminal: {
                      ...settings.terminal,
                      scrollback: normalizeTerminalScrollback(n),
                    },
                  })
                }
              }}
              onBlur={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                patchSettings({
                  terminal: {
                    ...settings.terminal,
                    scrollback: normalizeTerminalScrollback(
                      Number.isNaN(n) ? DEFAULT_TERMINAL_SCROLLBACK : n,
                    ),
                  },
                })
              }}
            />
            <span className="text-sm text-muted-foreground">{t('settings.terminal.lines')}</span>
          </div>
        </SettingField>

        <SettingField
          icon={Bold}
          label={t('settings.terminal.drawBoldBright')}
          description={t('settings.terminal.drawBoldBrightDesc')}
          row
        >
          <Switch
            checked={settings.terminal.drawBoldTextInBrightColors}
            onCheckedChange={(drawBoldTextInBrightColors) =>
              patchSettings({ terminal: { ...settings.terminal, drawBoldTextInBrightColors } })
            }
          />
        </SettingField>

        <SettingField
          icon={MousePointer2}
          label={t('settings.terminal.rightClickCopyPaste')}
          description={t('settings.terminal.rightClickCopyPasteDesc')}
          row
        >
          <Switch
            checked={settings.terminal.rightClickCopyPaste}
            onCheckedChange={(rightClickCopyPaste) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  rightClickCopyPaste,
                  advancedRightClickMenu: rightClickCopyPaste
                    ? false
                    : settings.terminal.advancedRightClickMenu,
                },
              })
            }
          />
        </SettingField>

        <SettingField
          icon={MousePointer2}
          label={t('settings.terminal.advancedRightClickMenu')}
          description={t('settings.terminal.advancedRightClickMenuDesc')}
          row
        >
          <Switch
            checked={settings.terminal.advancedRightClickMenu}
            onCheckedChange={(advancedRightClickMenu) =>
              patchSettings({
                terminal: {
                  ...settings.terminal,
                  advancedRightClickMenu,
                  rightClickCopyPaste: advancedRightClickMenu
                    ? false
                    : settings.terminal.rightClickCopyPaste,
                },
              })
            }
          />
        </SettingField>

        <SettingField
          icon={Layers}
          label={t('settings.terminal.synchronizedOutput')}
          description={
            domOnlyEmulator
              ? t('settings.terminal.synchronizedOutputWtermDesc')
              : t('settings.terminal.synchronizedOutputDesc')
          }
          row
        >
          <Switch
            checked={settings.terminal.synchronizedOutputEnabled}
            disabled={domOnlyEmulator}
            onCheckedChange={(synchronizedOutputEnabled) =>
              patchSettings({ terminal: { ...settings.terminal, synchronizedOutputEnabled } })
            }
          />
        </SettingField>

        <SettingField
          icon={Cpu}
          label={t('settings.terminal.renderer')}
          description={
            domOnlyEmulator
              ? t('settings.terminal.rendererWtermDesc')
              : t('settings.terminal.rendererDesc')
          }
        >
          <Select
            value={settings.terminal.renderer}
            disabled={domOnlyEmulator}
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
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField
          icon={Sparkles}
          label={t('settings.terminal.idleAnimation')}
          description={
            domOnlyEmulator
              ? t('settings.terminal.idleAnimationWtermDesc')
              : t('settings.terminal.idleAnimationDesc')
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {t('settings.terminal.idleAnimationEnabled')}
              </span>
              <Switch
                checked={idleAnimation.enabled}
                disabled={domOnlyEmulator}
                onCheckedChange={(enabled) =>
                  patchSettings({
                    terminal: {
                      ...settings.terminal,
                      idleAnimation: { ...idleAnimation, enabled },
                    },
                  })
                }
              />
            </div>

            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
                (!idleAnimation.enabled || domOnlyEmulator) && 'pointer-events-none opacity-50',
              )}
              role="tablist"
              aria-label={t('settings.terminal.idleAnimationModeAria')}
            >
              {idleAnimationModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={idleAnimation.mode === mode}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    idleAnimation.mode === mode
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
                  )}
                  disabled={domOnlyEmulator}
                  onClick={() =>
                    patchSettings({
                      terminal: {
                        ...settings.terminal,
                        idleAnimation: { ...idleAnimation, mode },
                      },
                    })
                  }
                >
                  {t(`settings.terminal.idleAnimationMode.${mode}`)}
                </button>
              ))}
            </div>

            <div
              className={cn(
                'flex items-center gap-2',
                (!idleAnimation.enabled || domOnlyEmulator) && 'pointer-events-none opacity-50',
              )}
            >
              <Input
                type="number"
                min={MIN_TERMINAL_IDLE_DELAY_MS / 1000}
                max={MAX_TERMINAL_IDLE_DELAY_MS / 1000}
                step={1}
                className="max-w-[120px]"
                disabled={domOnlyEmulator}
                value={Math.round(idleAnimation.idleDelayMs / 1000)}
                onChange={(e) => {
                  const sec = Number.parseInt(e.target.value, 10)
                  if (!Number.isNaN(sec)) {
                    patchSettings({
                      terminal: {
                        ...settings.terminal,
                        idleAnimation: {
                          ...idleAnimation,
                          idleDelayMs: normalizeTerminalIdleDelayMs(sec * 1000),
                        },
                      },
                    })
                  }
                }}
                onBlur={(e) => {
                  const sec = Number.parseInt(e.target.value, 10)
                  patchSettings({
                    terminal: {
                      ...settings.terminal,
                      idleAnimation: {
                        ...idleAnimation,
                        idleDelayMs: normalizeTerminalIdleDelayMs(
                          Number.isNaN(sec)
                            ? DEFAULT_TERMINAL_IDLE_DELAY_MS
                            : sec * 1000,
                        ),
                      },
                    },
                  })
                }}
              />
              <span className="text-sm text-muted-foreground">
                {t('settings.terminal.idleAnimationDelayUnit')}
              </span>
            </div>
          </div>
        </SettingField>

        <SettingField
          icon={Home}
          label={t('settings.terminal.welcomePage')}
          description={t('settings.terminal.welcomePageDesc')}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {t('settings.terminal.welcomePageEnabled')}
              </span>
              <Switch
                checked={welcomePage.enabled}
                onCheckedChange={(enabled) =>
                  patchSettings({
                    terminal: {
                      ...settings.terminal,
                      welcomePage: { ...welcomePage, enabled },
                    },
                  })
                }
              />
            </div>

            <div
              className={cn(
                'inline-flex w-fit max-w-full flex-wrap rounded-lg border border-border p-1',
                ui.segmentGroupBg,
                !welcomePage.enabled && 'pointer-events-none opacity-50',
              )}
              role="tablist"
              aria-label={t('settings.terminal.welcomePageAnimationAria')}
            >
              {WELCOME_PAGE_ANIMATION_MODES.map((mode: WelcomePageAnimationMode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={welcomePage.animation === mode}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    welcomePage.animation === mode
                      ? cn(ui.segmentActive, 'font-app-bold')
                      : cn(ui.segmentInactive, 'font-app-regular'),
                  )}
                  disabled={!welcomePage.enabled}
                  onClick={() =>
                    patchSettings({
                      terminal: {
                        ...settings.terminal,
                        welcomePage: { ...welcomePage, animation: mode },
                      },
                    })
                  }
                >
                  {t(`settings.terminal.welcomePageAnimation.${mode}`)}
                </button>
              ))}
            </div>
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
