import { session } from 'electron'
import {
  WEBVIEW_PREVIEW_PARTITION,
  getActiveWebviewCustomHeaders,
  type WebviewCustomHeader,
} from './shared/webview-preview'

let activeCustomHeaders: WebviewCustomHeader[] = []
let hooksRegistered = false

export function initWebviewPreviewSession(): void {
  if (hooksRegistered) return
  hooksRegistered = true

  const ses = session.fromPartition(WEBVIEW_PREVIEW_PARTITION)
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      if (activeCustomHeaders.length === 0) {
        callback({ requestHeaders: details.requestHeaders })
        return
      }
      const requestHeaders = { ...details.requestHeaders }
      for (const header of activeCustomHeaders) {
        requestHeaders[header.name] = header.value
      }
      callback({ requestHeaders })
    },
  )
}

export function syncWebviewPreviewCustomHeaders(headers: WebviewCustomHeader[]): void {
  activeCustomHeaders = getActiveWebviewCustomHeaders(headers)
}

export async function syncWebviewPreviewProxy(proxyRules: string): Promise<void> {
  const ses = session.fromPartition(WEBVIEW_PREVIEW_PARTITION)
  const rules = proxyRules.trim()
  if (!rules) {
    await ses.setProxy({ mode: 'direct' })
    return
  }
  await ses.setProxy({ proxyRules: rules })
}

export async function clearWebviewPreviewBrowsingData(): Promise<{ ok: boolean; error?: string }> {
  try {
    const ses = session.fromPartition(WEBVIEW_PREVIEW_PARTITION)
    await ses.clearCache()
    await ses.clearStorageData({
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'serviceworkers',
        'cachestorage',
      ],
    })
    ses.clearAuthCache()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
