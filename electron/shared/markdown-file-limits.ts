/** Maximum Markdown file size allowed for editor open (10 MB). */
export const MAX_MD_FILE_BYTES = 10 * 1024 * 1024

export const MARKDOWN_FILE_EXTENSIONS = ['md', 'markdown'] as const

export function isMarkdownFilePath(filePath: string): boolean {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  const ext = base.slice(dot + 1).toLowerCase()
  return (MARKDOWN_FILE_EXTENSIONS as readonly string[]).includes(ext)
}
