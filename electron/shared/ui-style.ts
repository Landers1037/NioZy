type ThemeMode = 'light' | 'dark'

/** minimal：暖中性灰极简；niozy：原版 NioZy；windowsClassic：Windows XP 怀旧；waFu：日式传统和风；cyberpunk：赛博朋克霓虹；glass：半透明玻璃；claude：Claude 暖奶油白编辑风；neumorphism：Neumorphism Soft UI 拟态 */
export type UiStyle =
  | 'minimal'
  | 'niozy'
  | 'windowsClassic'
  | 'waFu'
  | 'cyberpunk'
  | 'glass'
  | 'claude'
  | 'neumorphism'

export const UI_STYLE_VALUES: UiStyle[] = [
  'minimal',
  'niozy',
  'windowsClassic',
  'waFu',
  'cyberpunk',
  'glass',
  'claude',
  'neumorphism',
]

export function normalizeUiStyle(value: unknown): UiStyle {
  if (value === 'niozy') return 'niozy'
  if (value === 'windowsClassic') return 'windowsClassic'
  if (value === 'waFu') return 'waFu'
  if (value === 'cyberpunk') return 'cyberpunk'
  if (value === 'glass' || value === 'liquidGlass') return 'glass'
  if (value === 'claude') return 'claude'
  if (value === 'neumorphism') return 'neumorphism'
  return 'minimal'
}

/** 写入 document.documentElement.dataset.uiStyle */
export function uiStyleToDataAttribute(style: UiStyle): string {
  if (style === 'niozy') return 'niozy'
  if (style === 'windowsClassic') return 'windows-classic'
  if (style === 'waFu') return 'wa-fu'
  if (style === 'cyberpunk') return 'cyberpunk'
  if (style === 'glass') return 'glass'
  if (style === 'claude') return 'claude'
  if (style === 'neumorphism') return 'neumorphism'
  return 'minimal'
}

const WINDOW_BG: Record<UiStyle, Record<ThemeMode, string>> = {
  minimal: { light: '#F5F4F2', dark: '#171615' },
  niozy: { light: '#F4F5F7', dark: '#0F1419' },
  windowsClassic: { light: '#ECE9D8', dark: '#2A2A2A' },
  waFu: { light: '#F5F0E6', dark: '#1C1814' },
  cyberpunk: { light: '#E4E0F0', dark: '#0B0B14' },
  glass: { light: '#E8EBF0', dark: '#12141A' },
  claude: { light: '#F4F1EA', dark: '#1C1A17' },
  neumorphism: { light: '#E4E9F0', dark: '#2B3038' },
}

export function getWindowBackgroundColor(theme: ThemeMode, uiStyle: UiStyle): string {
  return WINDOW_BG[uiStyle][theme]
}
