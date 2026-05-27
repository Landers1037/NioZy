import type { PreviewSettings } from '../../electron/shared/preview-settings'
import { buildLocalPreviewUrl, buildLocalTextPreviewUrl } from '../../electron/shared/local-file-url'
import { fileExtension } from '../../electron/shared/terminal-preview-files'
import type { TerminalPreviewFileKind } from '../../electron/shared/terminal-preview-files'

export function previewUrlForFile(
  filePath: string,
  kind: TerminalPreviewFileKind,
): string {
  const ext = fileExtension(filePath)
  if (kind === 'image' || ext === '.docx' || ext === '.xlsx' || ext === '.pdf') {
    return buildLocalPreviewUrl(filePath)
  }
  return buildLocalTextPreviewUrl(filePath)
}

export function isAnyPreviewEnabled(preview: PreviewSettings): boolean {
  return (
    preview.imagePreview ||
    preview.chartPreview ||
    preview.linkPreview ||
    preview.anyFilePreview
  )
}
