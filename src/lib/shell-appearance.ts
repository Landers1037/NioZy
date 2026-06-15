import type { BuiltinShellType } from '../../electron/shared/builtin-shells'

/** Shell icon luminance calibration anchors. */
export const SHELL_LUMINANCE_ANCHORS = [45, 0x3c, 0x7a] as const

/** Microsoft 品牌蓝（PowerShell / pwsh） */
export const MICROSOFT_SHELL_BLUE = '#0078D4'

/** CMD 终端图标灰色 */
export const CMD_SHELL_GRAY = '#6B7280'

export const BUILTIN_SHELL_ICON_COLORS: Record<BuiltinShellType, string> = {
  powershell: MICROSOFT_SHELL_BLUE,
  pwsh: MICROSOFT_SHELL_BLUE,
  cmd: CMD_SHELL_GRAY,
}
