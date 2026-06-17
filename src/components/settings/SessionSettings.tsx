import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Bot, MessageSquareCode, History } from 'lucide-react'
import { DEFAULT_CLAUDE_CODE_HISTORY_PATH } from '../../../electron/shared/session-settings'

export function SessionSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const closeSessionTabIfPresent = useAppStore((s) => s.closeSessionTabIfPresent)
  if (!settings) return null

  const session = settings.session
  const historyPathFocusRef = useRef(session.claudeCodeHistoryPath)
  const [historyPathDraft, setHistoryPathDraft] = useState(session.claudeCodeHistoryPath)

  useEffect(() => {
    setHistoryPathDraft(session.claudeCodeHistoryPath)
  }, [session.claudeCodeHistoryPath])

  const patchSession = (partial: Partial<typeof session>) =>
    patchSettings({
      session: {
        ...session,
        ...partial,
      },
    })

  const handleAgentSessionToggle = (enabled: boolean) => {
    if (enabled === session.agentSessionEnabled) return
    patchSession({ agentSessionEnabled: enabled })
    if (!enabled) closeSessionTabIfPresent()
  }

  const commitHistoryPath = useCallback(
    (raw: string) => {
      const next = raw.trim() || DEFAULT_CLAUDE_CODE_HISTORY_PATH
      setHistoryPathDraft(next)
      if (next === session.claudeCodeHistoryPath) return
      void patchSession({ claudeCodeHistoryPath: next }).catch(() =>
        toast.error(t('settings.vault.saveFailed')),
      )
    },
    [patchSession, session.claudeCodeHistoryPath, t],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.session.title')}</CardTitle>
        <CardDescription>{t('settings.session.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Bot}
          label={t('settings.session.agentSessionEnabled')}
          description={t('settings.session.agentSessionEnabledDesc')}
          row
        >
          <Switch
            checked={session.agentSessionEnabled === true}
            onCheckedChange={handleAgentSessionToggle}
          />
        </SettingField>

        <SettingField
          icon={MessageSquareCode}
          label={t('settings.session.claudeCodeSessionEnabled')}
          description={t('settings.session.claudeCodeSessionEnabledDesc')}
          row
        >
          <Switch
            checked={session.claudeCodeSessionEnabled === true}
            onCheckedChange={(enabled) => {
              if (enabled === session.claudeCodeSessionEnabled) return
              patchSession({ claudeCodeSessionEnabled: enabled })
            }}
          />
        </SettingField>

        {session.claudeCodeSessionEnabled && (
          <SettingField
            icon={History}
            label={t('settings.session.claudeCodeHistoryPath')}
            description={t('settings.session.claudeCodeHistoryPathDesc')}
          >
            <Input
              className="max-w-xl font-mono text-sm"
              value={historyPathDraft}
              placeholder={DEFAULT_CLAUDE_CODE_HISTORY_PATH}
              onFocus={() => {
                historyPathFocusRef.current = session.claudeCodeHistoryPath
              }}
              onChange={(e) => setHistoryPathDraft(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim() || DEFAULT_CLAUDE_CODE_HISTORY_PATH
                if (next === historyPathFocusRef.current) return
                commitHistoryPath(next)
              }}
            />
          </SettingField>
        )}

        <SettingField
          icon={MessageSquareCode}
          label={t('settings.session.openCodeSessionEnabled')}
          description={t('settings.session.openCodeSessionEnabledDesc')}
          row
        >
          <Switch checked={false} disabled />
        </SettingField>

        <SettingField
          icon={Bot}
          label={t('settings.session.piAgentSessionEnabled')}
          description={t('settings.session.piAgentSessionEnabledDesc')}
          row
        >
          <Switch checked={false} disabled />
        </SettingField>
      </CardContent>
    </Card>
  )
}
