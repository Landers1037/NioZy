export function basenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || filePath
}

export const DEFAULT_MARKDOWN_FILE_NAME = 'untitled.md'

export function defaultFileNameFromPath(filePath: string | null | undefined): string {
  if (!filePath) return DEFAULT_MARKDOWN_FILE_NAME
  const base = basenameFromPath(filePath)
  return base.toLowerCase().endsWith('.md') || base.toLowerCase().endsWith('.markdown')
    ? base
    : `${base}.md`
}
