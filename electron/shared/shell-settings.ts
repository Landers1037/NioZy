import { normalizeCommandReplayList, type CommandReplayItem } from './command-replay'
import { DEFAULT_OH_MY_POSH_THEME, normalizeOhMyPoshTheme, type OhMyPoshThemeId } from './oh-my-posh-themes'

export type { CommandReplayItem }

export interface ShellSettings {
  /** 使用 Unicode 11 宽度表，正确渲染 emoji 等宽字符 */
  emojiNativeRendering: boolean
  /** 高亮终端中的 http / https 链接 */
  highlightLinks: boolean
  /** 按日志级别为终端输出行着色（ERROR / WARNING 等，类似 MobaXterm） */
  highlightLogLevels: boolean
  /** 单击链接时用系统默认浏览器打开 */
  clickToOpenLinks: boolean
  /** 将 Shift/Ctrl+Enter 等修饰键组合映射为换行（交互式 CLI） */
  shiftEnterNewline: boolean
  /** 在侧栏终端 Tab 名称左侧显示编号 */
  showTerminalIndex: boolean
  /** 长按侧栏终端 Tab 2s 后可拖拽调整顺序 */
  enableTabDrag: boolean
  /** 在 pwsh 会话中注入内置 Oh My Posh + posh-git（不修改用户 Profile） */
  ohMyPoshEnabled: boolean
  /** 内置 Oh My Posh 主题 */
  ohMyPoshTheme: OhMyPoshThemeId
  /** 命令重放列表 */
  commandReplays: CommandReplayItem[]
  /** 重启后恢复上次终端 Tab 结构与连接配置 */
  restoreTerminalSessionOnRestart: boolean
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  emojiNativeRendering: false,
  highlightLinks: false,
  highlightLogLevels: true,
  clickToOpenLinks: false,
  shiftEnterNewline: false,
  showTerminalIndex: false,
  enableTabDrag: false,
  ohMyPoshEnabled: false,
  ohMyPoshTheme: DEFAULT_OH_MY_POSH_THEME,
  commandReplays: [],
  restoreTerminalSessionOnRestart: false,
}

export function normalizeShellSettings(value: unknown): ShellSettings {
  const v = value && typeof value === 'object' ? (value as Partial<ShellSettings>) : {}
  return {
    emojiNativeRendering:
      typeof v.emojiNativeRendering === 'boolean'
        ? v.emojiNativeRendering
        : DEFAULT_SHELL_SETTINGS.emojiNativeRendering,
    highlightLinks:
      typeof v.highlightLinks === 'boolean'
        ? v.highlightLinks
        : DEFAULT_SHELL_SETTINGS.highlightLinks,
    highlightLogLevels:
      typeof v.highlightLogLevels === 'boolean'
        ? v.highlightLogLevels
        : DEFAULT_SHELL_SETTINGS.highlightLogLevels,
    clickToOpenLinks:
      typeof v.clickToOpenLinks === 'boolean'
        ? v.clickToOpenLinks
        : DEFAULT_SHELL_SETTINGS.clickToOpenLinks,
    shiftEnterNewline:
      typeof v.shiftEnterNewline === 'boolean'
        ? v.shiftEnterNewline
        : DEFAULT_SHELL_SETTINGS.shiftEnterNewline,
    showTerminalIndex:
      typeof v.showTerminalIndex === 'boolean'
        ? v.showTerminalIndex
        : DEFAULT_SHELL_SETTINGS.showTerminalIndex,
    enableTabDrag:
      typeof v.enableTabDrag === 'boolean'
        ? v.enableTabDrag
        : DEFAULT_SHELL_SETTINGS.enableTabDrag,
    ohMyPoshEnabled:
      typeof v.ohMyPoshEnabled === 'boolean'
        ? v.ohMyPoshEnabled
        : DEFAULT_SHELL_SETTINGS.ohMyPoshEnabled,
    ohMyPoshTheme: normalizeOhMyPoshTheme(v.ohMyPoshTheme),
    commandReplays: normalizeCommandReplayList(v.commandReplays),
    restoreTerminalSessionOnRestart:
      typeof v.restoreTerminalSessionOnRestart === 'boolean'
        ? v.restoreTerminalSessionOnRestart
        : DEFAULT_SHELL_SETTINGS.restoreTerminalSessionOnRestart,
  }
}
