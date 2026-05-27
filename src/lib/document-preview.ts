import type { DocumentRenderMode } from '../../electron/shared/preview-settings'

export function isJsPreviewDocumentExt(ext: string): boolean {
  return ext === '.docx' || ext === '.xlsx' || ext === '.csv'
}

export function shouldUseJsPreviewDocument(
  mode: DocumentRenderMode,
  ext: string,
): boolean {
  return mode === 'js-preview' && isJsPreviewDocumentExt(ext)
}

export function jsPreviewKindFromExt(ext: string): 'docx' | 'excel' | null {
  if (ext === '.docx') return 'docx'
  if (ext === '.xlsx' || ext === '.csv') return 'excel'
  return null
}
