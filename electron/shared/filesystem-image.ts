const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.avif',
])

function extensionOfPath(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const base = slash >= 0 ? filePath.slice(slash + 1) : filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

export function isImageFilePath(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOfPath(filePath))
}

export function imageMimeFromPath(filePath: string): string {
  const ext = extensionOfPath(filePath)
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.avif': 'image/avif',
  }
  return map[ext] ?? 'application/octet-stream'
}
