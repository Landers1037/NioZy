import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { relaunchApp } from '@/lib/app-relaunch'
import { SettingField } from './SettingField'
import { Terminal } from 'lucide-react'
import type { TerminalEmulator } from '../../../electron/shared/experimental-settings'
import { normalizeRendererForEmulator } from '@/lib/terminal-emulator'

export function ExperimentalSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const emulator = settings.experimental.terminalEmulator

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
              }).then(() => {
                toast.info(t('toast.terminalEmulatorRestart'), {
                  duration: 10_000,
                  action: {
                    label: t('toast.restartApp'),
                    onClick: () => relaunchApp(),
                  },
                })
              })
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
      </CardContent>
    </Card>
  )
}
