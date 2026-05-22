import { app } from 'electron'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'node:url'

/** 资源管理器右键菜单专用图标（与 exe 内嵌图标解耦，避免 dev 下指向 electron.exe） */
export const SHELL_MENU_ICON_FILENAME = 'shell-menu.ico'

/** 打包后 electron-builder extraResources 写入的文件名 */
export const PACKAGED_SHELL_MENU_ICON = 'icon.ico'

function getShellContextMenuIconCandidates(): string[] {
  const mainDir = dirname(fileURLToPath(import.meta.url))
  const exeDir = dirname(app.getPath('exe'))
  return [
    join(process.resourcesPath, PACKAGED_SHELL_MENU_ICON),
    join(process.resourcesPath, SHELL_MENU_ICON_FILENAME),
    join(exeDir, 'resources', PACKAGED_SHELL_MENU_ICON),
    join(exeDir, 'resources', SHELL_MENU_ICON_FILENAME),
    join(app.getAppPath(), 'electron', 'assets', SHELL_MENU_ICON_FILENAME),
    join(app.getAppPath(), 'build', 'icon.ico'),
    join(process.cwd(), 'electron', 'assets', SHELL_MENU_ICON_FILENAME),
    join(process.cwd(), 'build', 'icon.ico'),
    join(mainDir, 'assets', SHELL_MENU_ICON_FILENAME),
    join(mainDir, '..', 'assets', SHELL_MENU_ICON_FILENAME),
    join(mainDir, '..', '..', 'electron', 'assets', SHELL_MENU_ICON_FILENAME),
    join(mainDir, '..', '..', 'build', 'icon.ico'),
  ]
}

/** 解析用于注册表 Icon 值的 .ico 绝对路径；找不到时返回 null */
export function resolveShellContextMenuIconPath(): string | null {
  for (const candidate of getShellContextMenuIconCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
