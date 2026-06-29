import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getElectronAPI } from '@/lib/electron-client'
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
import { InputWithVaultPicker } from './InputWithVaultPicker'
import { AiContextSettings } from './AiContextSettings'
import {
  Bot,
  Brain,
  Download,
  FileText,
  FolderOpen,
  Network,
  Paperclip,
} from 'lucide-react'
import type { AiProvider } from '../../../electron/shared/ai-provider-settings'
import type { AiSidebarWidthPreset } from '@/lib/ai-sidebar-width'
import type { AgentBinaryStatus } from '../../../electron/shared/agent-types'
import { AI_SIDEBAR_WIDTH_PRESETS, AI_SIDEBAR_WIDTH_PX } from '@/lib/ai-sidebar-width'
import {
  AI_PROVIDERS,
  AI_PROVIDER_DEFAULT_BASE_URL,
  AI_PROVIDER_MODELS,
  DEFAULT_AI_RUNTIME_PORT,
  MAX_AI_RUNTIME_PORT,
  MIN_AI_RUNTIME_PORT,
  aiProviderNeedsApiKey,
  isAiPresetModel,
  normalizeAiModel,
  normalizeAiRuntimePort,
} from '@/lib/ai-provider-options'
import {
  DEFAULT_NIOZY_AGENT_MAX_TOKENS,
  NIOZY_AGENT_LOG_LEVELS,
} from '../../../electron/shared/experimental-settings'

export function AiSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const ai = settings.experimental
  const apiKeyFocusRef = useRef(ai.aiApiKey)
  const baseUrlFocusRef = useRef(ai.aiBaseUrl)
  const modelFocusRef = useRef(ai.aiModel)
  const runtimePortFocusRef = useRef(ai.aiRuntimePort)
  const agentMaxTokensFocusRef = useRef(ai.niozyAgentMaxTokens)
  const [apiKeyDraft, setApiKeyDraft] = useState(ai.aiApiKey)
  const [baseUrlDraft, setBaseUrlDraft] = useState(ai.aiBaseUrl)
  const [modelDraft, setModelDraft] = useState(ai.aiModel)
  const [runtimePortDraft, setRuntimePortDraft] = useState(String(ai.aiRuntimePort))
  const [agentLogFileDraft, setAgentLogFileDraft] = useState(ai.niozyAgentLogFile)
  const [agentMaxTokensDraft, setAgentMaxTokensDraft] = useState(
    String(ai.niozyAgentMaxTokens),
  )
  const [agentBinaryStatus, setAgentBinaryStatus] = useState<AgentBinaryStatus | null>(null)
  const [checkingAgentBinary, setCheckingAgentBinary] = useState(false)
  const [downloadingAgentBinary, setDownloadingAgentBinary] = useState(false)
  const presetModels = AI_PROVIDER_MODELS[ai.aiProvider]
  const modelSelectValue = isAiPresetModel(ai.aiProvider, ai.aiModel) ? ai.aiModel : ''

  useEffect(() => {
    setApiKeyDraft(ai.aiApiKey)
  }, [ai.aiApiKey])

  useEffect(() => {
    setBaseUrlDraft(ai.aiBaseUrl)
  }, [ai.aiBaseUrl])

  useEffect(() => {
    setRuntimePortDraft(String(ai.aiRuntimePort))
  }, [ai.aiRuntimePort])

  useEffect(() => {
    setModelDraft(ai.aiModel)
  }, [ai.aiModel])

  useEffect(() => {
    setAgentLogFileDraft(ai.niozyAgentLogFile)
  }, [ai.niozyAgentLogFile])

  useEffect(() => {
    setAgentMaxTokensDraft(String(ai.niozyAgentMaxTokens))
  }, [ai.niozyAgentMaxTokens])

  const patchAi = (partial: Partial<typeof ai>) =>
    patchSettings({
      experimental: {
        ...ai,
        ...partial,
      },
    })

  const commitApiKey = useCallback(
    (raw: string) => {
      const next = raw.trim()
      setApiKeyDraft(next)
      if (next === ai.aiApiKey) return
      void patchAi({ aiApiKey: next }).catch(() =>
        toast.error(t('settings.vault.saveFailed')),
      )
    },
    [ai, patchAi, t],
  )

  const handleProviderChange = (provider: AiProvider) => {
    if (provider === ai.aiProvider) return
    patchAi({
      aiProvider: provider,
      aiModel: AI_PROVIDER_MODELS[provider][0],
      aiBaseUrl: AI_PROVIDER_DEFAULT_BASE_URL[provider],
    })
  }

  const refreshAgentBinaryStatus = useCallback(async () => {
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
  }, [t])

  useEffect(() => {
    void refreshAgentBinaryStatus()
  }, [refreshAgentBinaryStatus])

  const handleDownloadAgentBinary = useCallback(async () => {
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
  }, [agentBinaryStatus, downloadingAgentBinary, refreshAgentBinaryStatus, t])

  const agentBinarySourceLabel = agentBinaryStatus
    ? t(`settings.ai.agentBinarySources.${agentBinaryStatus.activeSource}`)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.ai.title')}</CardTitle>
        <CardDescription>{t('settings.ai.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SettingField
          icon={Brain}
          label={t('settings.ai.sidebarEnabled')}
          description={t('settings.ai.sidebarEnabledDesc')}
          row
        >
          <Switch
            checked={ai.aiSidebarEnabled === true}
            onCheckedChange={(enabled) => {
              if (enabled === ai.aiSidebarEnabled) return
              patchAi({ aiSidebarEnabled: enabled })
            }}
          />
        </SettingField>

        <SettingField
          icon={Bot}
          label={t('settings.ai.agentGroupTitle')}
          description={t('settings.ai.agentGroupDesc')}
        >
          <div className="flex flex-col gap-4 rounded-xl border border-border/70 p-4">
            <SettingField
              icon={Bot}
              label={t('settings.ai.agentEnabled')}
              description={t('settings.ai.agentEnabledDesc')}
              row
              className="max-w-none"
            >
              <Switch
                checked={ai.niozyAgentEnabled === true}
                onCheckedChange={(enabled) => {
                  if (enabled === ai.niozyAgentEnabled) return
                  patchAi({ niozyAgentEnabled: enabled })
                }}
              />
            </SettingField>

            <SettingField
              icon={FileText}
              label={t('settings.ai.agentLogLevel')}
              description={t('settings.ai.agentLogLevelDesc')}
            >
              <Select
                value={ai.niozyAgentLogLevel}
                onValueChange={(value) => {
                  if (value === ai.niozyAgentLogLevel) return
                  patchAi({
                    niozyAgentLogLevel: value as typeof ai.niozyAgentLogLevel,
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
                onFocus={() => {
                  agentMaxTokensFocusRef.current = ai.niozyAgentMaxTokens
                }}
                onChange={(e) => setAgentMaxTokensDraft(e.currentTarget.value)}
                onBlur={(e) => {
                  const parsed = Number(e.currentTarget.value)
                  const next =
                    Number.isFinite(parsed) && parsed > 0
                      ? Math.max(1, Math.round(parsed))
                      : DEFAULT_NIOZY_AGENT_MAX_TOKENS
                  setAgentMaxTokensDraft(String(next))
                  if (next === agentMaxTokensFocusRef.current) return
                  patchAi({ niozyAgentMaxTokens: next }).catch(() =>
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
              className="max-w-none"
            >
              <Switch
                checked={ai.niozyAgentLogToFile === true}
                onCheckedChange={(enabled) => {
                  if (enabled === ai.niozyAgentLogToFile) return
                  patchAi({ niozyAgentLogToFile: enabled })
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
                  disabled={ai.niozyAgentLogToFile !== true}
                  placeholder={t('settings.ai.agentLogFilePlaceholder')}
                  className="min-w-0 flex-1 font-mono text-sm"
                  onChange={(e) => setAgentLogFileDraft(e.target.value)}
                  onBlur={(e) => {
                    const next = e.target.value.trim()
                    if (next === ai.niozyAgentLogFile) return
                    patchAi({ niozyAgentLogFile: next }).catch(() =>
                      toast.error(t('settings.vault.saveFailed')),
                    )
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={ai.niozyAgentLogToFile !== true}
                  onClick={() =>
                    void getElectronAPI()
                      .files.pickAgentLogFile()
                      .then((filePath) => {
                        if (!filePath) return
                        setAgentLogFileDraft(filePath)
                        return patchAi({ niozyAgentLogFile: filePath })
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
          </div>
        </SettingField>

        {ai.aiSidebarEnabled === true && (
          <>
            <SettingField
              icon={Paperclip}
              label={t('settings.ai.attachmentsEnabled')}
              description={t('settings.ai.attachmentsEnabledDesc')}
              row
            >
              <Switch
                checked={ai.aiAttachmentsEnabled === true}
                onCheckedChange={(enabled) => {
                  if (enabled === ai.aiAttachmentsEnabled) return
                  patchAi({ aiAttachmentsEnabled: enabled })
                }}
              />
            </SettingField>

            <SettingField
              icon={Brain}
              label={t('settings.ai.sidebarWidth')}
              description={t('settings.ai.sidebarWidthDesc')}
            >
              <Select
                value={ai.aiSidebarWidth}
                onValueChange={(v) => {
                  const preset = v as AiSidebarWidthPreset
                  if (preset === ai.aiSidebarWidth) return
                  patchAi({ aiSidebarWidth: preset })
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_SIDEBAR_WIDTH_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {t(`settings.ai.sidebarWidths.${preset}`, {
                        px: AI_SIDEBAR_WIDTH_PX[preset],
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingField>

            <SettingField
              icon={Network}
              label={t('settings.ai.runtimePort')}
              description={t('settings.ai.runtimePortDesc')}
            >
              <Input
                type="number"
                min={MIN_AI_RUNTIME_PORT}
                max={MAX_AI_RUNTIME_PORT}
                className="max-w-xs font-mono text-sm"
                value={runtimePortDraft}
                placeholder={String(DEFAULT_AI_RUNTIME_PORT)}
                onFocus={() => {
                  runtimePortFocusRef.current = ai.aiRuntimePort
                }}
                onChange={(e) => setRuntimePortDraft(e.target.value)}
                onBlur={(e) => {
                  const next = normalizeAiRuntimePort(e.target.value)
                  setRuntimePortDraft(String(next))
                  if (next === runtimePortFocusRef.current) return
                  patchAi({ aiRuntimePort: next }).catch(() =>
                    toast.error(t('settings.vault.saveFailed')),
                  )
                }}
              />
            </SettingField>

            <SettingField
              icon={Brain}
              label={t('settings.ai.provider')}
              description={t('settings.ai.providerDesc')}
            >
              <Select value={ai.aiProvider} onValueChange={(v) => handleProviderChange(v as AiProvider)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {t(`settings.ai.providers.${provider}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingField>

            <SettingField
              icon={Brain}
              label={t('settings.ai.model')}
              description={t('settings.ai.modelDesc')}
            >
              <div className="flex max-w-xl flex-col gap-2">
                <Select
                  value={modelSelectValue}
                  onValueChange={(model) => {
                    if (!model || model === ai.aiModel) return
                    setModelDraft(model)
                    patchAi({ aiModel: model })
                  }}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder={t('settings.ai.modelPresetPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {presetModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="font-mono text-sm"
                  value={modelDraft}
                  placeholder={t('settings.ai.modelCustomPlaceholder')}
                  onFocus={() => {
                    modelFocusRef.current = ai.aiModel
                  }}
                  onChange={(e) => setModelDraft(e.target.value)}
                  onBlur={(e) => {
                    const next = normalizeAiModel(ai.aiProvider, e.target.value)
                    setModelDraft(next)
                    if (next === modelFocusRef.current) return
                    patchAi({ aiModel: next }).catch(() =>
                      toast.error(t('settings.vault.saveFailed')),
                    )
                  }}
                />
              </div>
            </SettingField>

            <SettingField
              icon={Brain}
              label={t('settings.ai.baseUrl')}
              description={t('settings.ai.baseUrlDesc')}
            >
              <Input
                type="url"
                className="max-w-xl font-mono text-sm"
                value={baseUrlDraft}
                placeholder={
                  ai.aiProvider === 'openai-compatible'
                    ? t('settings.ai.baseUrlOpenAiCompatiblePlaceholder')
                    : AI_PROVIDER_DEFAULT_BASE_URL[ai.aiProvider]
                }
                onFocus={() => {
                  baseUrlFocusRef.current = ai.aiBaseUrl
                }}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                onBlur={(e) => {
                  const fallback = AI_PROVIDER_DEFAULT_BASE_URL[ai.aiProvider]
                  const next = e.target.value.trim() || fallback
                  setBaseUrlDraft(next || fallback)
                  if (next === baseUrlFocusRef.current) return
                  patchAi({ aiBaseUrl: next }).catch(() =>
                    toast.error(t('settings.vault.saveFailed')),
                  )
                }}
              />
            </SettingField>

            <SettingField
              icon={Brain}
              label={t('settings.ai.apiKey')}
              description={
                aiProviderNeedsApiKey(ai.aiProvider)
                  ? t('settings.ai.apiKeyDesc')
                  : t('settings.ai.apiKeyOptionalDesc')
              }
            >
              <InputWithVaultPicker
                type="password"
                wrapperClassName="w-full max-w-xl"
                className="min-w-0 flex-1 font-mono text-sm"
                value={apiKeyDraft}
                placeholder={
                  aiProviderNeedsApiKey(ai.aiProvider)
                    ? t('settings.ai.apiKeyPlaceholder')
                    : t('settings.ai.apiKeyOptionalPlaceholder')
                }
                onFocus={() => {
                  apiKeyFocusRef.current = ai.aiApiKey
                }}
                onChange={setApiKeyDraft}
                onAfterVaultInsert={commitApiKey}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next === apiKeyFocusRef.current) return
                  commitApiKey(next)
                }}
              />
            </SettingField>
          </>
        )}

        {ai.aiSidebarEnabled === true && <AiContextSettings />}
      </CardContent>
    </Card>
  )
}
