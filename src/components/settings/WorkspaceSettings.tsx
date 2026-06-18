import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { GitBranch, SquareTerminal } from 'lucide-react'
import { closeAllWorkspaceTabs } from '@/lib/workspace-actions'

export function WorkspaceSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const workspace = settings.workspace

  const patchWorkspace = (partial: Partial<typeof workspace>) =>
    patchSettings({
      workspace: {
        ...workspace,
        ...partial,
      },
    })

  const handleWorkspaceToggle = (enabled: boolean) => {
    if (enabled === workspace.workspaceEnabled) return
    patchWorkspace({ workspaceEnabled: enabled })
    if (!enabled) {
      void closeAllWorkspaceTabs()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.workspace.title')}</CardTitle>
        <CardDescription>{t('settings.workspace.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={SquareTerminal}
          label={t('settings.workspace.workspaceEnabled')}
          description={t('settings.workspace.workspaceEnabledDesc')}
          row
        >
          <Switch
            checked={workspace.workspaceEnabled === true}
            onCheckedChange={handleWorkspaceToggle}
          />
        </SettingField>

        <SettingField
          icon={GitBranch}
          label={t('settings.workspace.gitWorkspaceEnabled')}
          description={t('settings.workspace.gitWorkspaceEnabledDesc')}
          row
        >
          <Switch
            checked={workspace.gitWorkspaceEnabled === true}
            disabled={!workspace.workspaceEnabled}
            onCheckedChange={(enabled) => {
              if (enabled === workspace.gitWorkspaceEnabled) return
              patchWorkspace({ gitWorkspaceEnabled: enabled })
            }}
          />
        </SettingField>
      </CardContent>
    </Card>
  )
}
