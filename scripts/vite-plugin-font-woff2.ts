import fontverter from 'fontverter'
import type { Plugin } from 'vite'

const FONT_SOURCE_RE = /\.(ttf|otf)$/i
const FONT_FACE_SRC_RE =
  /url\(([^)]+\.(?:ttf|otf))\)\s*format\(['"]?(truetype|opentype)['"]?\)/gi

/** 生产构建时将打包产物中的 TTF/OTF 转为 WOFF2，并同步更新 CSS 中的 @font-face。 */
export function fontWoff2Plugin(): Plugin {
  return {
    name: 'font-woff2',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const renames = new Map<string, string>()

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'asset' || !FONT_SOURCE_RE.test(fileName)) continue

        const raw = chunk.source
        const buffer = Buffer.isBuffer(raw)
          ? raw
          : Buffer.from(typeof raw === 'string' ? raw : (raw as Uint8Array))

        const woff2 = await fontverter.convert(buffer, 'woff2')
        const newFileName = fileName.replace(FONT_SOURCE_RE, '.woff2')

        renames.set(fileName, newFileName)
        delete bundle[fileName]
        bundle[newFileName] = {
          ...chunk,
          fileName: newFileName,
          source: woff2,
        }
      }

      if (renames.size === 0) return

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'asset' || !chunk.fileName?.endsWith('.css')) continue
        if (typeof chunk.source !== 'string') continue

        chunk.source = chunk.source.replace(FONT_FACE_SRC_RE, (_match, url: string) => {
          const newUrl = url.replace(FONT_SOURCE_RE, '.woff2')
          return `url(${newUrl}) format('woff2')`
        })
      }
    },
  }
}
