import { protocol, net } from 'electron'
import { createReadStream, existsSync } from 'fs'
import { stat } from 'fs/promises'
import { normalize } from 'path'
import { pathToFileURL } from 'url'
import { imageMimeFromPath, isImageFilePath } from './shared/filesystem-image'
import {
  isChartFilePath,
  MAX_TEXT_PREVIEW_BYTES,
} from './shared/terminal-preview-files'
import {
  LOCAL_FILE_SCHEME,
  buildLocalPreviewUrl,
  buildLocalTextPreviewUrl,
} from './shared/local-file-url'

export { LOCAL_FILE_SCHEME, buildLocalPreviewUrl, buildLocalTextPreviewUrl }

const MAX_IMAGE_PREVIEW_BYTES = 20 * 1024 * 1024

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

function parseFilePathFromUrl(requestUrl: string): { host: string; filePath: string } | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${LOCAL_FILE_SCHEME}:`) return null
    const raw = url.searchParams.get('path')
    if (!raw) return null
    const filePath = normalize(decodeURIComponent(raw))
    if (filePath.includes('..')) return null
    return { host: url.hostname, filePath }
  } catch {
    return null
  }
}

function textMimeFromPath(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  const map: Record<string, string> = {
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.csv': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
  }
  return map[ext] ?? 'text/plain; charset=utf-8'
}

async function serveTextSlice(filePath: string, maxBytes: number): Promise<Response> {
  const st = await stat(filePath)
  if (!st.isFile()) return new Response('Forbidden', { status: 403 })
  const length = Math.min(st.size, maxBytes)
  const stream = createReadStream(filePath, { start: 0, end: length > 0 ? length - 1 : 0 })
  const headers: Record<string, string> = {
    'Content-Type': textMimeFromPath(filePath),
    'Content-Length': String(length),
  }
  if (st.size > maxBytes) {
    headers['X-NioZy-Truncated'] = '1'
  }
  return new Response(stream as unknown as ReadableStream, { status: 200, headers })
}

/** 须在 app.ready 之后调用 */
export async function registerLocalFileProtocolHandler(): Promise<void> {
  protocol.handle(LOCAL_FILE_SCHEME, async (request) => {
    const parsed = parseFilePathFromUrl(request.url)
    if (!parsed || !existsSync(parsed.filePath)) {
      return new Response('Not found', { status: 404 })
    }

    const { host, filePath } = parsed

    try {
      const st = await stat(filePath)
      if (!st.isFile()) return new Response('Forbidden', { status: 403 })

      if (host === 'text') {
        return serveTextSlice(filePath, MAX_TEXT_PREVIEW_BYTES)
      }

      if (host === 'preview') {
        if (isImageFilePath(filePath)) {
          if (st.size > MAX_IMAGE_PREVIEW_BYTES) {
            return new Response('Forbidden', { status: 403 })
          }
          const headers = { 'Content-Type': imageMimeFromPath(filePath) }
          return net.fetch(pathToFileURL(filePath).href, { headers })
        }

        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
        if (ext === '.docx' || ext === '.xlsx') {
          if (st.size > MAX_TEXT_PREVIEW_BYTES * 4) {
            return new Response('Forbidden', { status: 403 })
          }
          const headers = {
            'Content-Type':
              ext === '.docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }
          return net.fetch(pathToFileURL(filePath).href, { headers })
        }

        if (ext === '.pdf') {
          if (st.size > MAX_IMAGE_PREVIEW_BYTES) {
            return new Response('Forbidden', { status: 403 })
          }
          const headers = { 'Content-Type': 'application/pdf' }
          return net.fetch(pathToFileURL(filePath).href, { headers })
        }

        if (isChartFilePath(filePath) || ext.length > 0) {
          return serveTextSlice(filePath, MAX_TEXT_PREVIEW_BYTES)
        }
      }

      return new Response('Forbidden', { status: 403 })
    } catch {
      return new Response('Error', { status: 500 })
    }
  })
}
