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
import { Bold, Cpu, MousePointer2, Palette, ScrollText, TextCursor, Type } from 'lucide-react'
import { isWtermEmulator } from '@/lib/terminal-emulator'

export function TerminalSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const ui = useUiClasses()
  if (!settings) return null

  const scheme = settings.terminal.colorScheme
  const cursorOptions = getCursorStyleOptions(t)
  const useWterm = isWtermEmulator(settings)

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
          <FontFamilyPicker
            value={settings.terminal.fontFamily}
            onChange={(fontFamily) =>
              patchSettings({ terminal: { ...settings.terminal, fontFamily } })
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
              patchSettings({ terminal: { ...settings.terminal, rightClickCopyPaste } })
            }
          />
        </SettingField>

        <SettingField
          icon={Cpu}
          label={t('settings.terminal.renderer')}
          description={
            useWterm
              ? t('settings.terminal.rendererWtermDesc')
              : t('settings.terminal.rendererDesc')
          }
        >
          <Select
            value={settings.terminal.renderer}
            disabled={useWterm}
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
              <SelectItem value="canvas">{t('settings.terminal.rendererCanvas')}</SelectItem>
              <SelectItem value="webgl">{t('settings.terminal.rendererWebgl')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>
      </CardContent>
    </Card>
  )
}
