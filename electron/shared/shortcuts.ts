export interface AppShortcuts {
  global: {
    /** 切换主窗口显示/隐藏：前台则退到后台，否则显示到前台（不改变当前标签页） */
    showApp: string
    /** 打开屏幕截图（需辅助功能中开启屏幕截图；空字符串表示未设置） */
    screenshot: string
  }
  app: {
    copyToClipboard: string
    pasteFromClipboard: string
    lineStart: string
    lineEnd: string
    clearTerminal: string
    newTerminal: string
    openSettings: string
    prevTerminalTab: string
    nextTerminalTab: string
    /** 打开/关闭命令面板 */
    commandPalette: string
  }
}

export const DEFAULT_SHORTCUTS: AppShortcuts = {
  global: {
    showApp: 'CommandOrControl+T',
    screenshot: '',
  },
  app: {
    copyToClipboard: 'CommandOrControl+Shift+C',
    pasteFromClipboard: 'CommandOrControl+Shift+V',
    lineStart: 'Home',
    lineEnd: 'End',
    clearTerminal: 'CommandOrControl+K',
    newTerminal: 'CommandOrControl+Shift+T',
    openSettings: 'CommandOrControl+,',
    prevTerminalTab: 'CommandOrControl+Left',
    nextTerminalTab: 'CommandOrControl+Right',
    commandPalette: 'CommandOrControl+Shift+P',
  },
}

export const APP_SHORTCUT_LABELS: Record<keyof AppShortcuts['app'], string> = {
  copyToClipboard: '复制到剪贴板',
  pasteFromClipboard: '从剪贴板粘贴',
  lineStart: '切换到行首',
  lineEnd: '切换到行尾',
  clearTerminal: '清空终端内容',
  newTerminal: '打开新的终端',
  openSettings: '打开设置页面',
  prevTerminalTab: '切换到上一个终端 Tab',
  nextTerminalTab: '切换到下一个终端 Tab',
  commandPalette: '打开/关闭命令面板',
}
