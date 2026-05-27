export const WEBVIEW_PREVIEW_PARTITION = 'persist:niozy-link-preview'

export interface WebviewCustomHeader {
  name: string
  value: string
}

export const MAX_WEBVIEW_CUSTOM_HEADERS = 32

export function normalizeWebviewCustomHeaders(value: unknown): WebviewCustomHeader[] {
  if (!Array.isArray(value)) return []
  const out: WebviewCustomHeader[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Partial<WebviewCustomHeader>
    out.push({
      name: typeof raw.name === 'string' ? raw.name : '',
      value: typeof raw.value === 'string' ? raw.value : '',
    })
    if (out.length >= MAX_WEBVIEW_CUSTOM_HEADERS) break
  }
  return out
}

/** Headers with a non-empty name — used when attaching to outgoing requests. */
export function getActiveWebviewCustomHeaders(
  headers: WebviewCustomHeader[],
): WebviewCustomHeader[] {
  return headers
    .map((h) => ({ name: h.name.trim(), value: h.value }))
    .filter((h) => h.name.length > 0)
}
