export const LOCAL_FILE_SCHEME = 'niozy-local'

export function buildLocalPreviewUrl(filePath: string): string {
  return `${LOCAL_FILE_SCHEME}://preview?path=${encodeURIComponent(filePath)}`
}

export function buildLocalTextPreviewUrl(filePath: string): string {
  return `${LOCAL_FILE_SCHEME}://text?path=${encodeURIComponent(filePath)}`
}
