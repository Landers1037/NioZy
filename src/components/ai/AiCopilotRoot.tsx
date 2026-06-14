import { forwardRef, useCallback, useEffect, useState, type ButtonHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar, useCopilotChatConfiguration } from '@copilotkit/react-core/v2'
import '@copilotkit/react-core/v2/styles.css'
import { useAppStore } from '@/stores/app-store'
import { resolveAiSidebarWidthPx } from '@/lib/ai-sidebar-width'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'
import { buildAiRuntimeConfig } from '../../../electron/shared/experimental-settings'
import { aiProviderNeedsApiKey, isAiApiKeyConfigured } from '@/lib/ai-provider-options'
import { getElectronAPI } from '@/lib/electron-client'
import { clickCopilotFileInput } from '@/lib/click-copilot-file-input'

type AiAddAttachmentButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onAddFile?: () => void
}

/** Skip CopilotKit's dropdown; open the file picker on + click (Electron-safe). */
function AiAddAttachmentButton({
  onAddFile,
  disabled,
  className = '',
  ...props
}: AiAddAttachmentButtonProps) {
  return (
    <button
      type="button"
      data-testid="copilot-add-menu-button"
      disabled={disabled || !onAddFile}
      onClick={() => onAddFile?.()}
      className={`cpk:ml-1 cpk:inline-flex cpk:size-9 cpk:shrink-0 cpk:items-center cpk:justify-center cpk:rounded-full cpk:text-muted-foreground cpk:transition-colors hover:cpk:bg-muted disabled:cpk:pointer-events-none disabled:cpk:opacity-50 ${className}`.trim()}
      {...props}
    >
      <Plus className="cpk:size-[20px]" aria-hidden />
    </button>
  )
}

function AiSidebarModalBridge() {
  const isOpen = useAiSidebarStore((s) => s.isOpen)
  const setOpen = useAiSidebarStore((s) => s.setOpen)
  const registerSetModalOpen = useAiSidebarStore((s) => s.registerSetModalOpen)
  const unregisterSetModalOpen = useAiSidebarStore((s) => s.unregisterSetModalOpen)
  const config = useCopilotChatConfiguration()

  useEffect(() => {
    if (!config?.setModalOpen) return
    registerSetModalOpen(config.setModalOpen)
    return unregisterSetModalOpen
  }, [config?.setModalOpen, registerSetModalOpen, unregisterSetModalOpen])

  // Only the title bar toggle drives open state; never adopt CopilotKit's default on remount.
  useEffect(() => {
    if (!config?.setModalOpen) return
    config.setModalOpen(isOpen)
  }, [config?.setModalOpen, isOpen])

  // Still sync user closing the sidebar via its own UI back to the store.
  useEffect(() => {
    if (config?.isModalOpen !== false) return
    if (isOpen) setOpen(false)
  }, [config?.isModalOpen, isOpen, setOpen])

  return null
}

const HiddenAiSidebarToggle = forwardRef<HTMLButtonElement>(function HiddenAiSidebarToggle(
  _props,
  _ref,
) {
  return <AiSidebarModalBridge />
})

export function AiCopilotRoot() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const aiSidebarEnabled = settings?.experimental.aiSidebarEnabled === true
  const aiAttachmentsEnabled = settings?.experimental.aiAttachmentsEnabled === true
  const aiSidebarWidthPx = resolveAiSidebarWidthPx(
    settings?.experimental.aiSidebarWidth ?? 'default',
  )
  const aiRuntime = settings ? buildAiRuntimeConfig(settings.experimental) : null
  const runtimeConfigKey = aiRuntime
    ? `${aiRuntime.port}:${aiRuntime.provider}:${aiRuntime.model}:${aiRuntime.baseUrl}:${aiRuntime.apiKey}`
    : ''
  const [runtimeUrl, setRuntimeUrl] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const aiSidebarOpen = useAiSidebarStore((s) => s.isOpen)

  const handleAddFile = useCallback(() => {
    clickCopilotFileInput()
  }, [])

  useEffect(() => {
    if (!aiRuntime) {
      setConfigured(false)
      return
    }
    let cancelled = false
    void (async () => {
      const resolvedKey = aiProviderNeedsApiKey(aiRuntime.provider)
        ? (await getElectronAPI().vault.resolve(aiRuntime.apiKey)).trim()
        : ''
      if (cancelled) return
      setConfigured(
        isAiApiKeyConfigured({
          provider: aiRuntime.provider,
          apiKey: resolvedKey,
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [aiRuntime, runtimeConfigKey, aiSidebarOpen])

  useEffect(() => {
    if (!aiSidebarEnabled) {
      setRuntimeUrl(null)
      setConfigured(false)
      return
    }

    useAiSidebarStore.getState().setOpen(false)
    setRuntimeUrl(null)
    let cancelled = false
    let attempts = 0

    const loadRuntimeUrl = () => {
      void getElectronAPI()
        .copilot.getRuntimeUrl()
        .then(async (url) => {
          if (cancelled || !url) return
          try {
            const res = await fetch(`${url}/info`)
            if (cancelled || !res.ok) return
            setRuntimeUrl(url)
          } catch {
            if (!cancelled) setRuntimeUrl(null)
          }
        })
        .catch(() => {
          if (!cancelled) setRuntimeUrl(null)
        })
    }

    loadRuntimeUrl()
    const timer = window.setInterval(() => {
      attempts += 1
      loadRuntimeUrl()
      if (attempts >= 20) window.clearInterval(timer)
    }, 250)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [aiSidebarEnabled, runtimeConfigKey])

  useEffect(() => {
    return () => {
      useAiSidebarStore.getState().reset()
      document.body.style.marginInlineEnd = ''
      document.body.style.marginInlineStart = ''
      document.body.style.transition = ''
      setRuntimeUrl(null)
      setConfigured(false)
    }
  }, [])

  if (!aiSidebarEnabled || !runtimeUrl) return null

  return (
    <CopilotKit
      key={`${runtimeUrl}:${aiAttachmentsEnabled}`}
      runtimeUrl={runtimeUrl}
      useSingleEndpoint={false}
      enableInspector={false}
    >
      <CopilotSidebar
        defaultOpen={false}
        position="right"
        width={aiSidebarWidthPx}
        toggleButton={HiddenAiSidebarToggle}
        labels={{
          modalHeaderTitle: t('aiSidebar.title'),
          welcomeMessageText: configured
            ? t('aiSidebar.welcome')
            : t('aiSidebar.welcomeNoKey'),
          chatInputPlaceholder: t('aiSidebar.inputPlaceholder'),
          chatInputToolbarAddButtonLabel: t('aiSidebar.addAttachment'),
        }}
        attachments={aiAttachmentsEnabled ? { enabled: true } : undefined}
        input={
          aiAttachmentsEnabled
            ? { onAddFile: handleAddFile, addMenuButton: AiAddAttachmentButton }
            : undefined
        }
      />
    </CopilotKit>
  )
}
