type ThemeMode = 'light' | 'dark'

/** minimal：暖中性灰极简；niozy：原版 NioZy；windowsClassic：Windows XP 怀旧 */
export type UiStyle = 'minimal' | 'niozy' | 'windowsClassic'

export const UI_STYLE_VALUES: UiStyle[] = ['minimal', 'niozy', 'windowsClassic']

export function normalizeUiStyle(value: unknown): UiStyle {
  if (value === 'niozy') return 'niozy'
  if (value === 'windowsClassic') return 'windowsClassic'
  return 'minimal'
}

/** 写入 document.documentElement.dataset.uiStyle */
export function uiStyleToDataAttribute(style: UiStyle): string {
  if (style === 'niozy') return 'niozy'
  if (style === 'windowsClassic') return 'windows-classic'
  return 'minimal'
}

const WINDOW_BG: Record<UiStyle, Record<ThemeMode, string>> = {
  minimal: { light: '#F5F4F2', dark: '#171615' },
  niozy: { light: '#F4F5F7', dark: '#0F1419' },
  windowsClassic: { light: '#ECE9D8', dark: '#2A2A2A' },
}

export function getWindowBackgroundColor(theme: ThemeMode, uiStyle: UiStyle): string {
  return WINDOW_BG[uiStyle][theme]
}
