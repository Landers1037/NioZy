import { isImageFilePath } from './filesystem-image'

const CHART_EXTENSIONS = new Set([
  '.docx',
  '.xlsx',
  '.csv',
  '.txt',
  '.md',
])

export type TerminalPreviewFileKind = 'image' | 'chart' | 'any' | 'none'

export function fileExtension(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return ''
  return filePath.slice(dot).toLowerCase()
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
