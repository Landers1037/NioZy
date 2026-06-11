/**
 * 将 Excalidraw 字体复制到 public/excalidraw-fonts，供离线使用
 */
import { cpSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
const dest = resolve(root, 'public/excalidraw-fonts')

function main() {
  if (!existsSync(src)) {
    console.error(`[vendor-excalidraw-fonts] 未找到字体目录: ${src}`)
    console.error('请先运行 npm install @excalidraw/excalidraw')
    process.exit(1)
  }
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[vendor-excalidraw-fonts] 已复制到 ${dest}`)
}

main()
