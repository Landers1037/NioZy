import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { getSettingsFilePath } from './config-paths'

const DEFAULT_ENABLE_SMOOTH_SCROLLING = false

/** 启动最早阶段读取（须在 app.whenReady 之前用于 appendSwitch） */
export function isSmoothScrollingEnabled(): boolean {
  try {
    const path = getSettingsFilePath()
    if (!existsSync(path)) return DEFAULT_ENABLE_SMOOTH_SCROLLING
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      enableSmoothScrolling?: unknown
    }
    return typeof raw.enableSmoothScrolling === 'boolean'
      ? raw.enableSmoothScrolling
      : DEFAULT_ENABLE_SMOOTH_SCROLLING
  } catch {
    return DEFAULT_ENABLE_SMOOTH_SCROLLING
  }
}

/**
 * 在 app.whenReady() 之前调用：开启 Chromium 原生平滑滚动（滚轮 / 触控板惯性）。
 * 渲染层 xterm 视口另由 html[data-smooth-scroll] CSS 控制 scroll-behavior。
 * 修改设置后须完全重启应用生效。
 */
export function applySmoothScrollingFlags(): void {
  if (!isSmoothScrollingEnabled()) return
  app.commandLine.appendSwitch('enable-smooth-scrolling')
}
