export const MAX_AI_ATTACHMENT_BYTES = 20 * 1024 * 1024

export interface AiAttachmentPickFile {
  name: string
  mimeType: string
  base64: string
  size: number
}

export function guessAttachmentMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    zip: 'application/zip',
  }
  return map[ext] ?? 'application/octet-stream'
}
