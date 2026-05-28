import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { SettingField } from './SettingField'
import { Brain, Network } from 'lucide-react'
import type { AiProvider } from '../../../electron/shared/ai-provider-settings'
import {
  AI_PROVIDERS,
  AI_PROVIDER_DEFAULT_BASE_URL,
  AI_PROVIDER_MODELS,
  DEFAULT_AI_RUNTIME_PORT,
  MAX_AI_RUNTIME_PORT,
  MIN_AI_RUNTIME_PORT,
  aiProviderNeedsApiKey,
  normalizeAiRuntimePort,
} from '@/lib/ai-provider-options'

export function ExperimentalAiSettings() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const patchSettings = useAppStore((s) => s.patchSettings)
  if (!settings) return null

  const ai = settings.experimental
  const apiKeyFocusRef = useRef(ai.aiApiKey)
  const baseUrlFocusRef = useRef(ai.aiBaseUrl)
  const runtimePortFocusRef = useRef(ai.aiRuntimePort)
  const [apiKeyDraft, setApiKeyDraft] = useState(ai.aiApiKey)
  const [baseUrlDraft, setBaseUrlDraft] = useState(ai.aiBaseUrl)
  const [runtimePortDraft, setRuntimePortDraft] = useState(String(ai.aiRuntimePort))

  useEffect(() => {
    setApiKeyDraft(ai.aiApiKey)
  }, [ai.aiApiKey])

  useEffect(() => {
    setBaseUrlDraft(ai.aiBaseUrl)
  }, [ai.aiBaseUrl])

  useEffect(() => {
    setRuntimePortDraft(String(ai.aiRuntimePort))
  }, [ai.aiRuntimePort])

  const patchAi = (partial: Partial<typeof ai>) =>
    patchSettings({
      experimental: {
        ...ai,
        ...partial,
      },
    })

  const handleProviderChange = (provider: AiProvider) => {
    if (provider === ai.aiProvider) return
    patchAi({
      aiProvider: provider,
      aiModel: AI_PROVIDER_MODELS[provider][0],
      aiBaseUrl: AI_PROVIDER_DEFAULT_BASE_URL[provider],
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-medium">{t('settings.experimental.ai.title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('settings.experimental.ai.description')}
        </p>
      </div>

      <SettingField
        icon={Brain}
        label={t('settings.experimental.ai.sidebarEnabled')}
        description={t('settings.experimental.ai.sidebarEnabledDesc')}
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

      {ai.aiSidebarEnabled === true && (
        <>
          <SettingField
            icon={Network}
            label={t('settings.experimental.ai.runtimePort')}
            description={t('settings.experimental.ai.runtimePortDesc')}
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
            label={t('settings.experimental.ai.provider')}
            description={t('settings.experimental.ai.providerDesc')}
          >
            <Select value={ai.aiProvider} onValueChange={(v) => handleProviderChange(v as AiProvider)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {t(`settings.experimental.ai.providers.${provider}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField
            icon={Brain}
            label={t('settings.experimental.ai.model')}
            description={t('settings.experimental.ai.modelDesc')}
          >
            <Select
              value={ai.aiModel}
              onValueChange={(model) => {
                if (model === ai.aiModel) return
                patchAi({ aiModel: model })
              }}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDER_MODELS[ai.aiProvider].map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField
            icon={Brain}
            label={t('settings.experimental.ai.baseUrl')}
            description={t('settings.experimental.ai.baseUrlDesc')}
          >
            <Input
              type="url"
              className="max-w-xl font-mono text-sm"
              value={baseUrlDraft}
              placeholder={AI_PROVIDER_DEFAULT_BASE_URL[ai.aiProvider]}
              onFocus={() => {
                baseUrlFocusRef.current = ai.aiBaseUrl
              }}
              onChange={(e) => setBaseUrlDraft(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim() || AI_PROVIDER_DEFAULT_BASE_URL[ai.aiProvider]
                setBaseUrlDraft(next)
                if (next === baseUrlFocusRef.current) return
                patchAi({ aiBaseUrl: next }).catch(() =>
                  toast.error(t('settings.vault.saveFailed')),
                )
              }}
            />
          </SettingField>

          <SettingField
            icon={Brain}
            label={t('settings.experimental.ai.apiKey')}
            description={
              aiProviderNeedsApiKey(ai.aiProvider)
                ? t('settings.experimental.ai.apiKeyDesc')
                : t('settings.experimental.ai.apiKeyOptionalDesc')
            }
          >
            <Input
              type="password"
              className="max-w-xl font-mono text-sm"
              value={apiKeyDraft}
              placeholder={
                aiProviderNeedsApiKey(ai.aiProvider)
                  ? t('settings.experimental.ai.apiKeyPlaceholder')
                  : t('settings.experimental.ai.apiKeyOptionalPlaceholder')
              }
              onFocus={() => {
                apiKeyFocusRef.current = ai.aiApiKey
              }}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              onBlur={(e) => {
                const next = e.target.value.trim()
                setApiKeyDraft(next)
                if (next === apiKeyFocusRef.current) return
                patchAi({ aiApiKey: next }).catch(() =>
                  toast.error(t('settings.vault.saveFailed')),
                )
              }}
            />
          </SettingField>
        </>
      )}
    </div>
  )
}
