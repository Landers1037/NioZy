type ThemeMode = 'light' | 'dark'

/** minimal：暖中性灰极简；niozy：原版 NioZy；windowsClassic：Windows XP 怀旧；waFu：日式传统和风；cyberpunk：赛博朋克霓虹；glass：半透明玻璃 */
export type UiStyle =
  | 'minimal'
  | 'niozy'
  | 'windowsClassic'
  | 'waFu'
  | 'cyberpunk'
  | 'glass'

export const UI_STYLE_VALUES: UiStyle[] = [
  'minimal',
  'niozy',
  'windowsClassic',
  'waFu',
  'cyberpunk',
  'glass',
]

export function normalizeUiStyle(value: unknown): UiStyle {
  if (value === 'niozy') return 'niozy'
  if (value === 'windowsClassic') return 'windowsClassic'
  if (value === 'waFu') return 'waFu'
  if (value === 'cyberpunk') return 'cyberpunk'
  if (value === 'glass' || value === 'liquidGlass') return 'glass'
  return 'minimal'
}

/** 写入 document.documentElement.dataset.uiStyle */
export function uiStyleToDataAttribute(style: UiStyle): string {
  if (style === 'niozy') return 'niozy'
  if (style === 'windowsClassic') return 'windows-classic'
  if (style === 'waFu') return 'wa-fu'
  if (style === 'cyberpunk') return 'cyberpunk'
  if (style === 'glass') return 'glass'
  return 'minimal'
}

const WINDOW_BG: Record<UiStyle, Record<ThemeMode, string>> = {
  minimal: { light: '#F5F4F2', dark: '#171615' },
  niozy: { light: '#F4F5F7', dark: '#0F1419' },
  windowsClassic: { light: '#ECE9D8', dark: '#2A2A2A' },
  waFu: { light: '#F5F0E6', dark: '#1C1814' },
  cyberpunk: { light: '#E4E0F0', dark: '#0B0B14' },
  glass: { light: '#E8EBF0', dark: '#12141A' },
}

export function getWindowBackgroundColor(theme: ThemeMode, uiStyle: UiStyle): string {
  return WINDOW_BG[uiStyle][theme]
}
