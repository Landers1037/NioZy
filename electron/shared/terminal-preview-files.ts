import { isImageFilePath } from './filesystem-image'

const CHART_EXTENSIONS = new Set([
  '.docx',
  '.xlsx',
  '.csv',
  '.txt',
  '.md',
  '.pdf',
])

export type TerminalPreviewFileKind = 'image' | 'chart' | 'any' | 'none'

/** 仅取路径最后一段（文件名）的扩展名，避免把 `C:\Users\landers\...` 误判为 `.landers` */
export function fileExtension(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const base = slash >= 0 ? filePath.slice(slash + 1) : filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

export function classifyTerminalPreviewFile(filePath: string): TerminalPreviewFileKind {
  if (isImageFilePath(filePath)) return 'image'
  const ext = fileExtension(filePath)
  if (CHART_EXTENSIONS.has(ext)) return 'chart'
  if (ext.length > 0) return 'any'
  return 'none'
}

export function isChartFilePath(filePath: string): boolean {
  return CHART_EXTENSIONS.has(fileExtension(filePath))
}

export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024
