import { existsSync, readFileSync } from 'fs'
import { getSettingsFilePath } from './config-paths'
import {
  DEFAULT_SHELL_SETTINGS,
  normalizeShellSettings,
  type ShellSettings,
} from './shared/shell-settings'

/** 在 app.ready 之前同步读取 shell 段（主进程专用，勿在渲染进程引用）。 */
export function readShellSettingsFromDisk(): ShellSettings {
  try {
    const path = getSettingsFilePath()
    if (!existsSync(path)) return DEFAULT_SHELL_SETTINGS
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { shell?: unknown }
    return normalizeShellSettings(raw.shell)
  } catch {
    return DEFAULT_SHELL_SETTINGS
  }
}
