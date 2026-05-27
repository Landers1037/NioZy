import {
  normalizeWebviewCustomHeaders,
  type WebviewCustomHeader,
} from './webview-preview'

export type { WebviewCustomHeader }

export interface PreviewSettings {
  /** 终端中识别图片路径，Ctrl+Click 弹框预览（仅本地 Shell） */
  imagePreview: boolean
  /** 终端中识别图表/文档路径，Ctrl+Click 弹框预览 */
  chartPreview: boolean
  /** Ctrl+Click 链接在应用内 Tab 打开（走系统代理设置） */
  linkPreview: boolean
  /** 其余文件按文本预览，最多读取 1MB */
  anyFilePreview: boolean
  /** 链接预览 WebView 附加的 HTTP 请求头 */
  webviewCustomHeaders: WebviewCustomHeader[]
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  imagePreview: false,
  chartPreview: false,
  linkPreview: false,
  anyFilePreview: false,
  webviewCustomHeaders: [],
}

export function normalizePreviewSettings(value: unknown): PreviewSettings {
  const v = value && typeof value === 'object' ? (value as Partial<PreviewSettings>) : {}
  return {
    imagePreview:
      typeof v.imagePreview === 'boolean'
        ? v.imagePreview
        : DEFAULT_PREVIEW_SETTINGS.imagePreview,
    chartPreview:
      typeof v.chartPreview === 'boolean'
        ? v.chartPreview
        : DEFAULT_PREVIEW_SETTINGS.chartPreview,
    linkPreview:
      typeof v.linkPreview === 'boolean'
        ? v.linkPreview
        : DEFAULT_PREVIEW_SETTINGS.linkPreview,
    anyFilePreview:
      typeof v.anyFilePreview === 'boolean'
        ? v.anyFilePreview
        : DEFAULT_PREVIEW_SETTINGS.anyFilePreview,
    webviewCustomHeaders: normalizeWebviewCustomHeaders(v.webviewCustomHeaders),
  }
}
