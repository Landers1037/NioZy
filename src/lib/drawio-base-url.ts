/**
 * 解析离线 Draw.io embed 入口 URL（与主页面同源）。
 * 必须指向 drawio/index.html：Vite dev 下访问 /drawio 会 SPA 回退到主应用 mock 页。
 */
export function resolveDrawioBaseUrl(): string {
  return new URL('drawio/index.html', window.location.href).href
}
