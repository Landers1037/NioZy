import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar, useCopilotChatConfiguration, type CopilotSidebarProps } from '@copilotkit/react-core/v2'
import '@copilotkit/react-core/v2/styles.css'
import './ai-copilot-theme.css'
import { useAppStore } from '@/stores/app-store'
import { resolveAiSidebarWidthPx } from '@/lib/ai-sidebar-width'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'
import { buildAiRuntimeConfig } from '../../../electron/shared/ai-settings'
import { aiProviderNeedsApiKey, isAiApiKeyConfigured } from '@/lib/ai-provider-options'
import { getElectronAPI } from '@/lib/electron-client'
import { clickCopilotFileInput } from '@/lib/click-copilot-file-input'
import { appendCopilotChatInput } from '@/lib/append-copilot-chat-input'
import { AiCopilotContextBridge } from './AiCopilotContextBridge'
import { AiCopilotErrorBridge } from './AiCopilotErrorBridge'
import { AiCopilotNewChatBridge } from './AiCopilotNewChatBridge'
import { AiSidebarNewChatButton } from './AiCopilotSidebarHeader'

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

/** 将终端右键菜单排队的文本写入 Copilot 输入框（边栏打开后重试直至 textarea 就绪）。 */
function AiSidebarInputBridge() {
  const pendingInputAppend = useAiSidebarStore((s) => s.pendingInputAppend)
  const clearPendingInputAppend = useAiSidebarStore((s) => s.clearPendingInputAppend)
  const isOpen = useAiSidebarStore((s) => s.isOpen)

  useEffect(() => {
    if (!pendingInputAppend || !isOpen) return

    let cancelled = false
    let attempts = 0

    const tryAppend = () => {
      if (cancelled) return
      if (appendCopilotChatInput(pendingInputAppend)) {
        clearPendingInputAppend()
        return
      }
      attempts += 1
      if (attempts < 24) {
        window.setTimeout(tryAppend, 50)
      } else {
        clearPendingInputAppend()
      }
    }

    tryAppend()
    return () => {
      cancelled = true
    }
  }, [pendingInputAppend, isOpen, clearPendingInputAppend])

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
  const aiSidebarEnabled = settings?.ai.aiSidebarEnabled === true
  const aiAttachmentsEnabled = settings?.ai.aiAttachmentsEnabled === true
  const aiSidebarWidthPx = resolveAiSidebarWidthPx(
    settings?.ai.aiSidebarWidth ?? 'default',
  )
  const aiRuntime = settings ? buildAiRuntimeConfig(settings.ai) : null
  const runtimeConfigKey = aiRuntime
    ? `${aiRuntime.port}:${aiRuntime.provider}:${aiRuntime.model}:${aiRuntime.baseUrl}:${aiRuntime.apiKey}`
    : ''
  const [runtimeUrl, setRuntimeUrl] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const aiSidebarOpen = useAiSidebarStore((s) => s.isOpen)

  const sidebarHeader = useMemo(
    (): NonNullable<CopilotSidebarProps['header']> => ({
      title: t('aiSidebar.title'),
      children: ({ titleContent, closeButton }) => (
        <header
          data-testid="copilot-modal-header"
          data-slot="copilot-modal-header"
          className="copilotKitHeader cpk:flex cpk:items-center cpk:justify-between cpk:border-b cpk:border-border cpk:px-4 cpk:py-4 cpk:bg-background/95 cpk:backdrop-blur cpk:supports-[backdrop-filter]:bg-background/80"
        >
          <div className="cpk:flex cpk:w-full cpk:items-center cpk:gap-2">
            <div className="cpk:flex-1" aria-hidden />
            <div className="cpk:flex cpk:flex-1 cpk:justify-center cpk:text-center">{titleContent}</div>
            <div className="cpk:flex cpk:flex-1 cpk:items-center cpk:justify-end cpk:gap-1">
              <AiSidebarNewChatButton />
              {closeButton}
            </div>
          </div>
        </header>
      ),
    }),
    [t],
  )

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
      {/* 主题作用域 wrapper，与 CopilotKit 官方 CSS 自定义示例一致 */}
      <div className="niozy-ai-copilot-scope">
        <AiCopilotContextBridge />
        <AiCopilotErrorBridge />
        <AiCopilotNewChatBridge />
        <AiSidebarInputBridge />
        <CopilotSidebar
          defaultOpen={false}
          position="right"
          width={aiSidebarWidthPx}
          toggleButton={HiddenAiSidebarToggle}
          header={sidebarHeader}
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
      </div>
    </CopilotKit>
  )
}
