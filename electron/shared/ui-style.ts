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

/** Windows 原生背景材质：acrylic（Win10 1809+）/ mica（Win11） */
export type WindowsNativeEffect = 'acrylic' | 'mica'

export function normalizeWindowsNativeEffect(value: unknown): WindowsNativeEffect {
  return value === 'mica' ? 'mica' : 'acrylic'
}

/** 原生材质强度档位（1–5） */
export const WINDOWS_NATIVE_EFFECT_INTENSITY_MIN = 1
export const WINDOWS_NATIVE_EFFECT_INTENSITY_MAX = 5

const ACRYLIC_OPACITY_BY_INTENSITY = [10, 32, 48, 64, 86]
const MICA_OPACITY_BY_INTENSITY = [24, 36, 64, 72, 98]

export function normalizeWindowsNativeEffectIntensity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 3
  const rounded = Math.round(n)
  if (rounded < WINDOWS_NATIVE_EFFECT_INTENSITY_MIN) return WINDOWS_NATIVE_EFFECT_INTENSITY_MIN
  if (rounded > WINDOWS_NATIVE_EFFECT_INTENSITY_MAX) return WINDOWS_NATIVE_EFFECT_INTENSITY_MAX
  return rounded
}

/** chrome 层卡片不透明度百分比（0–100），档位越高越不透明 */
export function getWindowsNativeEffectCardOpacity(
  effect: WindowsNativeEffect,
  intensity: number,
): number {
  const idx = normalizeWindowsNativeEffectIntensity(intensity) - 1
  return effect === 'mica'
    ? MICA_OPACITY_BY_INTENSITY[idx]
    : ACRYLIC_OPACITY_BY_INTENSITY[idx]
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

/** 玻璃风格 +「透明效果」：窗口需透明以便顶栏/侧栏 backdrop-filter 透出桌面 */
export function shouldUseGlassWindowTransparency(
  uiStyle: UiStyle,
  enableGlassTransparency?: boolean,
): boolean {
  return uiStyle === 'glass' && enableGlassTransparency === true
}

export function getWindowBackgroundColor(
  theme: ThemeMode,
  uiStyle: UiStyle,
  enableGlassTransparency?: boolean,
  enableWindowsNativeEffect?: boolean,
): string {
  if (shouldUseGlassWindowTransparency(uiStyle, enableGlassTransparency)) {
    return '#00000000'
  }
  // Windows 原生 Acrylic/Mica 需要透明底色；不透明 backgroundColor 会整面遮住系统材质
  if (enableWindowsNativeEffect === true) {
    return '#00000000'
  }
  return WINDOW_BG[uiStyle][theme]
}
