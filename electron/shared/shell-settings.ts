export interface ShellSettings {
  /** 使用 Unicode 11 宽度表，正确渲染 emoji 等宽字符 */
  emojiNativeRendering: boolean
  /** 高亮终端中的 http / https 链接 */
  highlightLinks: boolean
  /** 单击链接时用系统默认浏览器打开 */
  clickToOpenLinks: boolean
  /** 将 Shift/Ctrl+Enter 等修饰键组合映射为换行（交互式 CLI） */
  shiftEnterNewline: boolean
  /** 在侧栏终端 Tab 名称左侧显示编号 */
  showTerminalIndex: boolean
  /** 长按侧栏终端 Tab 2s 后可拖拽调整顺序 */
  enableTabDrag: boolean
  /**
   * 非活动 Tab 优化：超过 5 分钟无操作的非活动 Tab 卸载终端视图（销毁 xterm/wterm），
   * 切回时重建；PTY 保持连接，输出在主进程缓冲。
   */
  inactiveTabOptimization: boolean
  /**
   * 非活动 Tab 休眠：启用 Chromium 后台节流，并对非活动 Tab 暂停实时推流（保留 PTY）。
   */
  inactiveTabSleep: boolean
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  emojiNativeRendering: false,
  highlightLinks: false,
  clickToOpenLinks: false,
  shiftEnterNewline: false,
  showTerminalIndex: false,
  enableTabDrag: false,
  inactiveTabOptimization: false,
  inactiveTabSleep: false,
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
    inactiveTabOptimization:
      typeof v.inactiveTabOptimization === 'boolean'
        ? v.inactiveTabOptimization
        : DEFAULT_SHELL_SETTINGS.inactiveTabOptimization,
    inactiveTabSleep:
      typeof v.inactiveTabSleep === 'boolean'
        ? v.inactiveTabSleep
        : DEFAULT_SHELL_SETTINGS.inactiveTabSleep,
  }
}
