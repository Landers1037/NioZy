/**
 * 从 src/logo.png 生成 Electron Windows 打包用的 build/icon.ico
 * 在 npm run build 前由 prebuild 钩子自动执行
 */
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const logoPath = resolve(root, 'src/logo.png')
const outDir = resolve(root, 'build')
const assetsDir = resolve(root, 'electron/assets')
const icoPath = resolve(outDir, 'icon.ico')
const pngPath = resolve(outDir, 'icon.png')
const shellMenuIcoPath = resolve(assetsDir, 'shell-menu.ico')

/** Windows ICO 常用尺寸 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

function iconsAlreadyBuilt() {
  return existsSync(icoPath) && existsSync(pngPath) && existsSync(shellMenuIcoPath)
}

async function main() {
  if (!existsSync(logoPath)) {
    console.error(`[generate-icon] 未找到源图: ${logoPath}`)
    process.exit(1)
  }

  if (iconsAlreadyBuilt()) {
    console.log(`[generate-icon] 已存在 ${icoPath}、${shellMenuIcoPath}、${pngPath}，跳过生成`)
    return
  }

  if (existsSync(icoPath) && !existsSync(shellMenuIcoPath)) {
    mkdirSync(assetsDir, { recursive: true })
    const { copyFileSync } = await import('fs')
    copyFileSync(icoPath, shellMenuIcoPath)
    console.log(`[generate-icon] 已从 ${icoPath} 同步 ${shellMenuIcoPath}`)
    if (existsSync(pngPath)) return
  }

  mkdirSync(outDir, { recursive: true })

  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  )

  const ico = await toIco(pngBuffers)
  await sharp(logoPath)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath)

  writeFileSync(icoPath, ico)
  mkdirSync(assetsDir, { recursive: true })
  writeFileSync(shellMenuIcoPath, ico)

  console.log(`[generate-icon] 已生成 ${icoPath}`)
  console.log(`[generate-icon] 已生成 ${shellMenuIcoPath}`)
  console.log(`[generate-icon] 已生成 ${pngPath}`)
}

main().catch((err) => {
  console.error('[generate-icon] 失败:', err)
  process.exit(1)
})
