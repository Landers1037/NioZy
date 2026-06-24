import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { getSettingsFilePath } from './config-paths'

const DEFAULT_ENABLE_SMOOTH_FONTS = false

/** 启动最早阶段读取（须在 app.whenReady 之前用于 appendSwitch） */
export function isSmoothFontsEnabled(): boolean {
  try {
    const path = getSettingsFilePath()
    if (!existsSync(path)) return DEFAULT_ENABLE_SMOOTH_FONTS
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { enableSmoothFonts?: unknown }
    return typeof raw.enableSmoothFonts === 'boolean'
      ? raw.enableSmoothFonts
      : DEFAULT_ENABLE_SMOOTH_FONTS
  } catch {
    return DEFAULT_ENABLE_SMOOTH_FONTS
  }
}

/**
 * 在 app.whenReady() 之前调用：启用类似 macOS 的平滑字体渲染路径。
 * Windows 下配合打包时嵌入的 PerMonitorV2 清单与 DirectWrite / ClearType 增强特性。
 *
 * 注意：勿设置 force-device-scale-factor。Chromium 只接受数字倍率，"auto" 会解析失败并
 * 回退为 1.0，在系统 125%/150% 缩放下会导致整窗 UI 变小。DPI 缩放由 PerMonitorV2 清单
 * 与 Electron 原生逻辑自动跟随系统。
 */
export function applySmoothFontFlags(): void {
  if (!isSmoothFontsEnabled()) return

  app.commandLine.appendSwitch('disable-gpu-rasterization')

  if (process.platform === 'win32') {
    // 强制走 DirectWrite + Windows ClearType / 对比度增强（Chrome 132+ 特性，显式确保开启）
    app.commandLine.appendSwitch(
      'enable-features',
      'IncreaseWindowsTextContrast,UseGammaContrastRegistrySettings',
    )
    app.commandLine.appendSwitch('enable-lcd-text')
  }
}
