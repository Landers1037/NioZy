export interface WebviewErrorPageOptions {
  url: string
  errorCode: number
  errorDescription: string
  title: string
  hint: string
  errorCodeLabel: string
  dark: boolean
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Inline error document shown inside <webview> when navigation fails. */
export function buildWebviewErrorPageDataUrl(options: WebviewErrorPageOptions): string {
  const bg = options.dark ? '#171615' : '#f5f4f2'
  const fg = options.dark ? '#ebe9e6' : '#2a2826'
  const muted = options.dark ? '#9a9691' : '#6b6762'
  const border = options.dark ? 'rgba(235, 233, 230, 0.12)' : 'rgba(42, 40, 38, 0.12)'
  const accent = options.dark ? '#e07a7a' : '#c45c5c'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', sans-serif;
      background: ${bg};
      color: ${fg};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      max-width: 32rem;
      width: 100%;
      border: 1px solid ${border};
      border-radius: 0.75rem;
      padding: 1.75rem 1.5rem;
    }
    .icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      background: color-mix(in srgb, ${accent} 18%, transparent);
      color: ${accent};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.5rem;
    }
    .url {
      font-size: 0.8125rem;
      word-break: break-all;
      color: ${muted};
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    .hint {
      font-size: 0.875rem;
      line-height: 1.55;
      color: ${muted};
      margin-bottom: 1rem;
    }
    .meta {
      font-size: 0.75rem;
      color: ${muted};
      font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon" aria-hidden="true">!</div>
    <h1>${escapeHtml(options.title)}</h1>
    <p class="url">${escapeHtml(options.url)}</p>
    <p class="hint">${escapeHtml(options.hint)}</p>
    <p class="meta">${escapeHtml(options.errorCodeLabel)}: ${options.errorCode}${
      options.errorDescription
        ? ` · ${escapeHtml(options.errorDescription)}`
        : ''
    }</p>
  </div>
</body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/** Chromium ERR_ABORTED – navigation cancelled, not a user-visible failure. */
export const WEBVIEW_ERR_ABORTED = -3

export function isWebviewErrorPageUrl(url: string): boolean {
  return url.startsWith('data:text/html')
}
