export interface ShellSettings {
  /** 使用 Unicode 11 宽度表，正确渲染 emoji 等宽字符 */
  emojiNativeRendering: boolean
  /** 高亮终端中的 http / https 链接 */
  highlightLinks: boolean
  /** 单击链接时用系统默认浏览器打开 */
  clickToOpenLinks: boolean
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  emojiNativeRendering: false,
  highlightLinks: false,
  clickToOpenLinks: false,
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
  }
}
