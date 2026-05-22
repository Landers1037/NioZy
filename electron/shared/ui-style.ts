type ThemeMode = 'light' | 'dark'

/** minimal：暖中性灰极简；niozy：原版 NioZy 界面 */
export type UiStyle = 'minimal' | 'niozy'

export const UI_STYLE_VALUES: UiStyle[] = ['minimal', 'niozy']

export function normalizeUiStyle(value: unknown): UiStyle {
  return value === 'niozy' ? 'niozy' : 'minimal'
}

const WINDOW_BG: Record<UiStyle, Record<ThemeMode, string>> = {
  minimal: { light: '#F5F4F2', dark: '#171615' },
  niozy: { light: '#F4F5F7', dark: '#0F1419' },
}

export function getWindowBackgroundColor(theme: ThemeMode, uiStyle: UiStyle): string {
  return WINDOW_BG[uiStyle][theme]
}
