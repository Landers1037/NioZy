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
import { ExperimentalAiSettings } from './ExperimentalAiSettings'
import { Braces, Cpu, Link2, ScrollText, Terminal, Monitor } from 'lucide-react'
import { isAttachPtyRenderMode } from '@/lib/attach-pty-render'
import type { TerminalEmulator } from '../../../electron/shared/experimental-settings'
import {
  MAX_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  MAX_GHOSTTY_SCROLLBACK_LIMIT,
  MIN_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  MIN_GHOSTTY_SCROLLBACK_LIMIT,
  normalizeAttachPtyTabSwitchDwellMs,
  normalizeGhosttyScrollbackLimit,
} from '../../../electron/shared/experimental-settings'
import { normalizeRendererForEmulator } from '@/lib/terminal-emulator'

function notifyRestartRequired(
  t: (key: string) => string,
  messageKey:
    | 'toast.terminalEmulatorRestart'
    | 'toast.ghosttyCoreRestart'
    | 'toast.attachPtyRenderRestart',
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
  const closeSandboxTabIfPresent = useAppStore((s) => s.closeSandboxTabIfPresent)
  const closeVncTabsIfPresent = useAppStore((s) => s.closeVncTabsIfPresent)
  if (!settings) return null

  const emulator = settings.experimental.terminalEmulator
  const jsSandboxEnabled = settings.experimental.jsSandboxEnabled
  const vncWebEnabled = settings.experimental.vncWebEnabled === true
  const vncAdaptiveScale = settings.experimental.vncAdaptiveScale !== false
  const ghosttyEnabled = settings.experimental.ghosttyCoreEnabled
  const attachPtyEnabled = settings.experimental.attachPtyRenderMode
  const attachPtyActive = isAttachPtyRenderMode(settings)
  const ghosttyScrollbackFocusRef = useRef(settings.experimental.ghosttyScrollbackLimit)
  const attachDwellFocusRef = useRef(settings.experimental.attachPtyTabSwitchDwellMs)

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

        <SettingField
          icon={Braces}
          label={t('settings.experimental.jsSandboxEnabled')}
          description={t('settings.experimental.jsSandboxEnabledDesc')}
          row
        >
          <Switch
            checked={jsSandboxEnabled}
            onCheckedChange={(enabled) => {
              if (enabled === jsSandboxEnabled) return
              void patchSettings({
                experimental: {
                  ...settings.experimental,
                  jsSandboxEnabled: enabled,
                },
              }).then(() => {
                if (!enabled) closeSandboxTabIfPresent()
              })
            }}
          />
        </SettingField>

        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-medium">{t('settings.experimental.vnc.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('settings.experimental.vnc.description')}
            </p>
          </div>

          <SettingField
            icon={Monitor}
            label={t('settings.experimental.vncWebEnabled')}
            description={t('settings.experimental.vncWebEnabledDesc')}
            row
          >
            <Switch
              checked={vncWebEnabled}
              onCheckedChange={(enabled) => {
                if (enabled === vncWebEnabled) return
                void patchSettings({
                  experimental: {
                    ...settings.experimental,
                    vncWebEnabled: enabled,
                  },
                }).then(() => {
                  if (!enabled) closeVncTabsIfPresent()
                })
              }}
            />
          </SettingField>

          {vncWebEnabled && (
            <SettingField
              icon={Monitor}
              label={t('settings.experimental.vncAdaptiveScale')}
              description={t('settings.experimental.vncAdaptiveScaleDesc')}
              row
            >
              <Switch
                checked={vncAdaptiveScale}
                onCheckedChange={(enabled) => {
                  if (enabled === vncAdaptiveScale) return
                  void patchSettings({
                    experimental: {
                      ...settings.experimental,
                      vncAdaptiveScale: enabled,
                    },
                  })
                }}
              />
            </SettingField>
          )}
        </div>

        <ExperimentalAiSettings />

        <SettingField
          icon={Link2}
          label={t('settings.experimental.attachPtyRenderMode')}
          description={t('settings.experimental.attachPtyRenderModeDesc')}
          row
        >
          <Switch
            checked={attachPtyActive}
            disabled={emulator === 'wterm'}
            onCheckedChange={(enabled) => {
              if (enabled === attachPtyEnabled) return
              void patchSettings({
                experimental: {
                  ...settings.experimental,
                  attachPtyRenderMode: enabled,
                },
              }).then(() => notifyRestartRequired(t, 'toast.attachPtyRenderRestart'))
            }}
          />
        </SettingField>

        {attachPtyActive && (
          <SettingField
            icon={Link2}
            label={t('settings.experimental.attachPtyTabSwitchDwellMs')}
            description={t('settings.experimental.attachPtyTabSwitchDwellMsDesc')}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={MIN_ATTACH_PTY_TAB_SWITCH_DWELL_MS}
                max={MAX_ATTACH_PTY_TAB_SWITCH_DWELL_MS}
                step={50}
                className="max-w-[120px]"
                value={settings.experimental.attachPtyTabSwitchDwellMs}
                onFocus={() => {
                  attachDwellFocusRef.current =
                    settings.experimental.attachPtyTabSwitchDwellMs
                }}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  if (!Number.isNaN(n)) {
                    void patchSettings({
                      experimental: {
                        ...settings.experimental,
                        attachPtyTabSwitchDwellMs: normalizeAttachPtyTabSwitchDwellMs(n),
                      },
                    })
                  }
                }}
                onBlur={(e) => {
                  const n = normalizeAttachPtyTabSwitchDwellMs(
                    Number.parseInt(e.target.value, 10),
                  )
                  if (n === attachDwellFocusRef.current) return
                  void patchSettings({
                    experimental: {
                      ...settings.experimental,
                      attachPtyTabSwitchDwellMs: n,
                    },
                  })
                }}
              />
              <span className="text-sm text-muted-foreground">ms</span>
            </div>
          </SettingField>
        )}

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
