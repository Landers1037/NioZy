import { useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { relaunchApp } from '@/lib/app-relaunch'
import { SettingField } from './SettingField'
import { Cpu, ScrollText, Terminal } from 'lucide-react'
import type { TerminalEmulator } from '../../../electron/shared/experimental-settings'
import {
  MAX_GHOSTTY_SCROLLBACK_LIMIT,
  MIN_GHOSTTY_SCROLLBACK_LIMIT,
  normalizeGhosttyScrollbackLimit,
} from '../../../electron/shared/experimental-settings'
import { normalizeRendererForEmulator } from '@/lib/terminal-emulator'

function notifyRestartRequired(
  t: (key: string) => string,
  messageKey: 'toast.terminalEmulatorRestart' | 'toast.ghosttyCoreRestart',
) {
  toast.info(t(messageKey), {
    duration: 10_000,
    action: {
      label: t('toast.restartApp'),
      onClick: () => relaunchApp(),
    },
  })
}

export function ExperimentalSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const emulator = settings.experimental.terminalEmulator
  const ghosttyEnabled = settings.experimental.ghosttyCoreEnabled
  const ghosttyScrollbackFocusRef = useRef(settings.experimental.ghosttyScrollbackLimit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.experimental.title')}</CardTitle>
        <CardDescription>{t('settings.experimental.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Terminal}
          label={t('settings.experimental.terminalEmulator')}
          description={t('settings.experimental.terminalEmulatorDesc')}
        >
          <Select
            value={emulator}
            onValueChange={(v) => {
              const next = v as TerminalEmulator
              if (next === emulator) return
              const renderer = normalizeRendererForEmulator(
                next,
                settings.terminal.renderer,
              )
              void patchSettings({
                experimental: {
                  ...settings.experimental,
                  terminalEmulator: next,
                },
                ...(next === 'wterm' && renderer !== settings.terminal.renderer
                  ? { terminal: { ...settings.terminal, renderer } }
                  : {}),
              }).then(() => notifyRestartRequired(t, 'toast.terminalEmulatorRestart'))
            }}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xterm">{t('settings.experimental.terminalEmulatorXterm')}</SelectItem>
              <SelectItem value="wterm">{t('settings.experimental.terminalEmulatorWterm')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingField>

        {emulator === 'wterm' && (
          <>
            <SettingField
              icon={Cpu}
              label={t('settings.experimental.ghosttyCoreEnabled')}
              description={t('settings.experimental.ghosttyCoreEnabledDesc')}
              row
            >
              <Switch
                checked={ghosttyEnabled}
                onCheckedChange={(enabled) => {
                  if (enabled === ghosttyEnabled) return
                  void patchSettings({
                    experimental: {
                      ...settings.experimental,
                      ghosttyCoreEnabled: enabled,
                    },
                  }).then(() => notifyRestartRequired(t, 'toast.ghosttyCoreRestart'))
                }}
              />
            </SettingField>

            {ghosttyEnabled && (
              <SettingField
                icon={ScrollText}
                label={t('settings.experimental.ghosttyScrollbackLimit')}
                description={t('settings.experimental.ghosttyScrollbackLimitDesc')}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={MIN_GHOSTTY_SCROLLBACK_LIMIT}
                    max={MAX_GHOSTTY_SCROLLBACK_LIMIT}
                    step={1000}
                    className="max-w-[120px]"
                    value={settings.experimental.ghosttyScrollbackLimit}
                    onFocus={() => {
                      ghosttyScrollbackFocusRef.current =
                        settings.experimental.ghosttyScrollbackLimit
                    }}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      if (!Number.isNaN(n)) {
                        void patchSettings({
                          experimental: {
                            ...settings.experimental,
                            ghosttyScrollbackLimit: normalizeGhosttyScrollbackLimit(n),
                          },
                        })
                      }
                    }}
                    onBlur={(e) => {
                      const n = normalizeGhosttyScrollbackLimit(
                        Number.parseInt(e.target.value, 10),
                      )
                      if (n === ghosttyScrollbackFocusRef.current) return
                      void patchSettings({
                        experimental: {
                          ...settings.experimental,
                          ghosttyScrollbackLimit: n,
                        },
                      }).then(() => notifyRestartRequired(t, 'toast.ghosttyCoreRestart'))
                    }}
                  />
                </div>
              </SettingField>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
