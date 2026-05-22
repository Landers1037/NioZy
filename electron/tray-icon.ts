import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'

/** 预生成托盘图尺寸（electron/assets/tray.png） */
const TRAY_ICON_SIZE = 64

export function loadTrayIcon(mainDir: string): NativeImage {
  const candidates = [
    join(mainDir, 'tray.png'),
    join(process.cwd(), 'electron/assets/tray.png'),
    join(app.getAppPath(), 'electron/assets/tray.png'),
    join(process.cwd(), 'src/logo.png'),
    fileURLToPath(new URL('../../src/logo.png', import.meta.url)),
  ]

  for (const file of candidates) {
    if (!existsSync(file)) continue
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) continue
    const size = image.getSize()
    if (size.width === TRAY_ICON_SIZE && size.height === TRAY_ICON_SIZE) return image
    return image.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE, quality: 'best' })
  }

  console.warn('[NioZy] Tray icon not found; tray may be invisible.')
  return nativeImage.createEmpty()
}
