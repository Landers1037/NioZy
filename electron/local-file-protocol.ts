import { protocol, net } from 'electron'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'
import { normalize } from 'path'
import { pathToFileURL } from 'url'
import { isImageFilePath } from './shared/filesystem-image'

export const LOCAL_FILE_SCHEME = 'niozy-local'

const MAX_PREVIEW_BYTES = 20 * 1024 * 1024

/** 须在 app.ready 之前调用 */
export function registerLocalFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_FILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        corsEnabled: true,
      },
    },
  ])
}

function parsePreviewFilePath(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${LOCAL_FILE_SCHEME}:`) return null
    if (url.hostname !== 'preview') return null
    const raw = url.searchParams.get('path')
    if (!raw) return null
    const filePath = normalize(decodeURIComponent(raw))
    if (filePath.includes('..')) return null
    return filePath
  } catch {
    return null
  }
}

/** 须在 app.ready 之后调用 */
export async function registerLocalFileProtocolHandler(): Promise<void> {
  protocol.handle(LOCAL_FILE_SCHEME, async (request) => {
    const filePath = parsePreviewFilePath(request.url)
    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }
    if (!isImageFilePath(filePath)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const st = await stat(filePath)
      if (!st.isFile() || st.size > MAX_PREVIEW_BYTES) {
        return new Response('Forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    } catch {
      return new Response('Error', { status: 500 })
    }
  })
}

export function buildLocalPreviewUrl(filePath: string): string {
  return `${LOCAL_FILE_SCHEME}://preview?path=${encodeURIComponent(normalize(filePath))}`
}
