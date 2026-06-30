import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bot, Download, FileText, FolderOpen, Search } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [agentBinaryPathDraft, setAgentBinaryPathDraft] = useState('')
  const [confirmDownloadStatus, setConfirmDownloadStatus] = useState<AgentBinaryStatus | null>(null)
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
      setAgentBinaryPathDraft(status.activeSource === 'missing' ? '' : status.activePath)
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

  const runDownloadAgentBinary = async (overwrite: boolean): Promise<boolean> => {
    setDownloadingAgentBinary(true)
    try {
      const result = await getElectronAPI().agent.downloadBinary(overwrite)
      if (!result.ok) {
        toast.error(
          t('settings.ai.agentBinaryDownloadFailed', {
            error: result.error,
          }),
        )
        return false
      }
      await refreshAgentBinaryStatus()
      toast.success(
        t('settings.ai.agentBinaryDownloadSuccess', {
          path: result.binaryPath,
          tag: result.releaseTag,
        }),
      )
      return true
    } finally {
      setDownloadingAgentBinary(false)
    }
  }

  const handleDownloadAgentBinary = async () => {
    if (downloadingAgentBinary) return
    const status = (await refreshAgentBinaryStatus()) ?? agentBinaryStatus
    if (!status) return
    const hasDetectedLocalBinary = status.activeSource !== 'missing'
    const requiresConfirm = hasDetectedLocalBinary || status.downloadedBinaryExists
    if (requiresConfirm) {
      setConfirmDownloadStatus(status)
      return
    }
    await runDownloadAgentBinary(false)
  }

  const agentBinarySourceLabel = agentBinaryStatus
    ? t(`settings.ai.agentBinarySources.${agentBinaryStatus.activeSource}`)
    : null
  const confirmPath = confirmDownloadStatus
    ? confirmDownloadStatus.downloadedBinaryExists
      ? confirmDownloadStatus.downloadPath
      : confirmDownloadStatus.activePath
    : ''

  return (
    <>
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
            <div className="flex max-w-xl flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t('settings.ai.agentBinaryPath')}
              </span>
              <Input
                value={agentBinaryPathDraft}
                readOnly
                placeholder={t('settings.ai.agentBinaryPathPlaceholder')}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={checkingAgentBinary || downloadingAgentBinary}
                onClick={() => void refreshAgentBinaryStatus()}
              >
                <Search className="size-4" />
                {checkingAgentBinary
                  ? t('settings.ai.agentBinaryDetecting')
                  : t('settings.ai.agentBinaryDetect')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={checkingAgentBinary || downloadingAgentBinary}
                onClick={() => void handleDownloadAgentBinary()}
              >
                <Download className="size-4" />
                {downloadingAgentBinary
                  ? t('settings.ai.agentBinaryDownloading')
                  : t('settings.ai.agentBinaryDownload')}
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

      <AlertDialog
        open={confirmDownloadStatus != null}
        onOpenChange={(open) => {
          if (!open && !downloadingAgentBinary) setConfirmDownloadStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.ai.agentBinaryOverwriteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDownloadStatus
                ? t('settings.ai.agentBinaryOverwriteConfirm', {
                    path: confirmPath,
                    targetPath: confirmDownloadStatus.downloadPath,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={downloadingAgentBinary}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={downloadingAgentBinary || confirmDownloadStatus == null}
              onClick={(e) => {
                e.preventDefault()
                if (!confirmDownloadStatus) return
                void runDownloadAgentBinary(true).then((ok) => {
                  if (ok) setConfirmDownloadStatus(null)
                })
              }}
            >
              {downloadingAgentBinary
                ? t('settings.ai.agentBinaryDownloading')
                : t('settings.ai.agentBinaryOverwriteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
