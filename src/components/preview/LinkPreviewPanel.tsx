import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppTab } from '@/stores/app-store'
import {
  buildWebviewErrorPageDataUrl,
  isWebviewErrorPageUrl,
  WEBVIEW_ERR_ABORTED,
} from '@/lib/webview-error-page'

interface LinkPreviewPanelProps {
  tab: AppTab
}

type WebviewFailLoadEvent = Event & {
  errorCode: number
  errorDescription: string
  validatedURL: string
  isMainFrame?: boolean
}

type WebviewElement = HTMLElement & {
  loadURL: (url: string) => Promise<void>
}

type PendingError = {
  url: string
  errorCode: number
  errorDescription: string
}

/**
 * Renders an external URL using Electron's <webview> guest-page element.
 * Normal navigation uses the `src` attribute (reliable before dom-ready).
 * On main-frame load failure, replaces the guest page with an inline error document.
 */
export function LinkPreviewPanel({ tab }: LinkPreviewPanelProps) {
  const ref = useRef<WebviewElement>(null)
  const guestReadyRef = useRef(false)
  const { t } = useTranslation()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    const el = ref.current
    const targetUrl = tab.webviewUrl
    if (!el || !targetUrl) return

    el.setAttribute('allowpopups', 'true')

    let pendingError: PendingError | null = null

    const showErrorPage = (
      url: string,
      errorCode: number,
      errorDescription: string,
    ): void => {
      if (!guestReadyRef.current) {
        pendingError = { url, errorCode, errorDescription }
        return
      }

      const dark = document.documentElement.classList.contains('dark')
      const dataUrl = buildWebviewErrorPageDataUrl({
        url,
        errorCode,
        errorDescription,
        dark,
        title: tRef.current('settings.preview.pageLoadFailed'),
        hint: tRef.current('settings.preview.pageLoadFailedHint'),
        errorCodeLabel: tRef.current('settings.preview.pageLoadErrorCode'),
      })
      void el.loadURL(dataUrl).catch(() => {
        /* guest may already be torn down */
      })
    }

    const handleFailLoad = (event: Event): void => {
      const e = event as WebviewFailLoadEvent
      if (e.isMainFrame !== true) return
      if (e.errorCode === WEBVIEW_ERR_ABORTED) return

      const failedUrl = e.validatedURL || targetUrl
      if (isWebviewErrorPageUrl(failedUrl)) return

      showErrorPage(failedUrl, e.errorCode, e.errorDescription)
    }

    const onDomReady = (): void => {
      guestReadyRef.current = true
      if (pendingError) {
        const err = pendingError
        pendingError = null
        showErrorPage(err.url, err.errorCode, err.errorDescription)
      }
    }

    el.addEventListener('did-fail-load', handleFailLoad)
    el.addEventListener('dom-ready', onDomReady)

    return () => {
      el.removeEventListener('did-fail-load', handleFailLoad)
      el.removeEventListener('dom-ready', onDomReady)
      pendingError = null
    }
  }, [tab.webviewUrl])

  useEffect(() => {
    return () => {
      guestReadyRef.current = false
    }
  }, [])

  if (!tab.webviewUrl) return null

  return (
    <webview
      ref={ref as React.Ref<HTMLElement>}
      src={tab.webviewUrl}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'flex',
      }}
    />
  )
}
