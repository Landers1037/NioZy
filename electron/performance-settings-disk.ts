import { existsSync, readFileSync } from 'fs'
import { getSettingsFilePath } from './config-paths'
import {
  DEFAULT_PERFORMANCE_SETTINGS,
  normalizePerformanceSettings,
  type PerformanceSettings,
} from './shared/performance-settings'

/** 在 app.ready 之前同步读取 performance 段（主进程专用，勿在渲染进程引用）。 */
export function readPerformanceSettingsFromDisk(): PerformanceSettings {
  try {
    const path = getSettingsFilePath()
    if (!existsSync(path)) return DEFAULT_PERFORMANCE_SETTINGS
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      performance?: unknown
      shell?: unknown
    }
    return normalizePerformanceSettings(raw.performance, raw.shell)
  } catch {
    return DEFAULT_PERFORMANCE_SETTINGS
  }
}
