import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bot, Download, FileText, FolderOpen } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { getElectronAPI } from '@/lib/electron-client'
import type { AgentBinaryStatus } from '../../../electron/shared/agent-types'
import {
  DEFAULT_NIOZY_AGENT_MAX_TOKENS,
  NIOZY_AGENT_LOG_LEVELS,
} from '../../../electron/shared/agent-settings'

export function AgentSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  const agent = settings?.agent
  const [agentBinaryStatus, setAgentBinaryStatus] = useState<AgentBinaryStatus | null>(null)
  const [checkingAgentBinary, setCheckingAgentBinary] = useState(false)
  const [downloadingAgentBinary, setDownloadingAgentBinary] = useState(false)
  const [agentLogFileDraft, setAgentLogFileDraft] = useState(agent?.niozyAgentLogFile ?? '')
  const [agentMaxTokensDraft, setAgentMaxTokensDraft] = useState(
    String(agent?.niozyAgentMaxTokens ?? DEFAULT_NIOZY_AGENT_MAX_TOKENS),
  )

  useEffect(() => {
    if (!agent) return
    setAgentLogFileDraft(agent.niozyAgentLogFile)
  }, [agent])

  useEffect(() => {
    if (!agent) return
    setAgentMaxTokensDraft(String(agent.niozyAgentMaxTokens))
  }, [agent])

  if (!settings || !agent) return null

  const patchAgent = (partial: Partial<typeof agent>) =>
    patchSettings({
      agent: {
        ...agent,
        ...partial,
      },
    })

  const refreshAgentBinaryStatus = async () => {
    setCheckingAgentBinary(true)
    try {
      const status = await getElectronAPI().agent.getBinaryStatus()
      setAgentBinaryStatus(status)
      return status
    } catch {
      toast.error(t('settings.ai.agentBinaryStatusFailed'))
      return null
    } finally {
      setCheckingAgentBinary(false)
    }
  }

  useEffect(() => {
    void refreshAgentBinaryStatus()
  }, [])

  const handleDownloadAgentBinary = async () => {
    if (downloadingAgentBinary) return
    const status = (await refreshAgentBinaryStatus()) ?? agentBinaryStatus
    if (!status) return
    const shouldOverwrite =
      status.downloadedBinaryExists &&
      window.confirm(t('settings.ai.agentBinaryOverwriteConfirm', { path: status.downloadPath }))
    if (status.downloadedBinaryExists && !shouldOverwrite) return

    setDownloadingAgentBinary(true)
    try {
      const result = await getElectronAPI().agent.downloadBinary(shouldOverwrite)
      if (!result.ok) {
        toast.error(
          t('settings.ai.agentBinaryDownloadFailed', {
            error: result.error,
          }),
        )
        return
      }
      await refreshAgentBinaryStatus()
      toast.success(
        t('settings.ai.agentBinaryDownloadSuccess', {
          path: result.binaryPath,
          tag: result.releaseTag,
        }),
      )
    } finally {
      setDownloadingAgentBinary(false)
    }
  }

  const agentBinarySourceLabel = agentBinaryStatus
    ? t(`settings.ai.agentBinarySources.${agentBinaryStatus.activeSource}`)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.ai.agentGroupTitle')}</CardTitle>
        <CardDescription>{t('settings.ai.agentGroupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Bot}
          label={t('settings.ai.agentEnabled')}
          description={t('settings.ai.agentEnabledDesc')}
          row
        >
          <Switch
            checked={agent.niozyAgentEnabled === true}
            onCheckedChange={(enabled) => {
              if (enabled === agent.niozyAgentEnabled) return
              patchAgent({ niozyAgentEnabled: enabled })
            }}
          />
        </SettingField>

        <SettingField
          icon={FileText}
          label={t('settings.ai.agentLogLevel')}
          description={t('settings.ai.agentLogLevelDesc')}
        >
          <Select
            value={agent.niozyAgentLogLevel}
            onValueChange={(value) => {
              if (value === agent.niozyAgentLogLevel) return
              patchAgent({
                niozyAgentLogLevel: value as typeof agent.niozyAgentLogLevel,
              })
            }}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NIOZY_AGENT_LOG_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingField>

        <SettingField
          icon={Bot}
          label={t('settings.ai.agentMaxTokens')}
          description={t('settings.ai.agentMaxTokensDesc')}
        >
          <Input
            type="number"
            min={1}
            className="max-w-xs font-mono text-sm"
            value={agentMaxTokensDraft}
            placeholder={String(DEFAULT_NIOZY_AGENT_MAX_TOKENS)}
            onChange={(e) => setAgentMaxTokensDraft(e.currentTarget.value)}
            onBlur={(e) => {
              const parsed = Number(e.currentTarget.value)
              const next =
                Number.isFinite(parsed) && parsed > 0
                  ? Math.max(1, Math.round(parsed))
                  : DEFAULT_NIOZY_AGENT_MAX_TOKENS
              setAgentMaxTokensDraft(String(next))
              if (next === agent.niozyAgentMaxTokens) return
              patchAgent({ niozyAgentMaxTokens: next }).catch(() =>
                toast.error(t('settings.vault.saveFailed')),
              )
            }}
          />
        </SettingField>

        <SettingField
          icon={FileText}
          label={t('settings.ai.agentLogToFile')}
          description={t('settings.ai.agentLogToFileDesc')}
          row
        >
          <Switch
            checked={agent.niozyAgentLogToFile === true}
            onCheckedChange={(enabled) => {
              if (enabled === agent.niozyAgentLogToFile) return
              patchAgent({ niozyAgentLogToFile: enabled })
            }}
          />
        </SettingField>

        <SettingField
          icon={FileText}
          label={t('settings.ai.agentLogFile')}
          description={t('settings.ai.agentLogFileDesc')}
        >
          <div className="flex max-w-xl gap-2">
            <Input
              value={agentLogFileDraft}
              disabled={agent.niozyAgentLogToFile !== true}
              placeholder={t('settings.ai.agentLogFilePlaceholder')}
              className="min-w-0 flex-1 font-mono text-sm"
              onChange={(e) => setAgentLogFileDraft(e.currentTarget.value)}
              onBlur={(e) => {
                const next = e.currentTarget.value.trim()
                if (next === agent.niozyAgentLogFile) return
                patchAgent({ niozyAgentLogFile: next }).catch(() =>
                  toast.error(t('settings.vault.saveFailed')),
                )
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={agent.niozyAgentLogToFile !== true}
              onClick={() =>
                void getElectronAPI()
                  .files.pickAgentLogFile()
                  .then((filePath) => {
                    if (!filePath) return
                    setAgentLogFileDraft(filePath)
                    return patchAgent({ niozyAgentLogFile: filePath })
                  })
                  .catch(() => toast.error(t('settings.ai.agentLogFilePickFailed')))
              }
            >
              <FolderOpen className="size-4" />
              {t('settings.ai.agentLogFileBrowse')}
            </Button>
          </div>
        </SettingField>

        <SettingField
          icon={Download}
          label={t('settings.ai.agentBinary')}
          description={t('settings.ai.agentBinaryDesc')}
        >
          <div className="flex max-w-3xl flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={checkingAgentBinary || downloadingAgentBinary}
                onClick={() => void handleDownloadAgentBinary()}
              >
                <Download className="size-4" />
                {downloadingAgentBinary
                  ? t('settings.ai.agentBinaryDownloading')
                  : t('settings.ai.agentBinaryDetectDownload')}
              </Button>
            </div>
            {agentBinaryStatus ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div>
                  {t('settings.ai.agentBinaryActiveSource', {
                    source: agentBinarySourceLabel ?? agentBinaryStatus.activeSource,
                  })}
                </div>
                <div className="break-all">
                  {t('settings.ai.agentBinaryActivePath', {
                    path: agentBinaryStatus.activePath,
                  })}
                </div>
                <div className="break-all">
                  {t('settings.ai.agentBinaryDownloadPath', {
                    path: agentBinaryStatus.downloadPath,
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </SettingField>
      </CardContent>
    </Card>
  )
}
