import type { TFunction } from 'i18next'
import type { AppSettings, LayoutMode } from '../../electron/shared/api-types'

/** Layout transition frame budget markers. */
export const LAYOUT_FRAME_BUDGET_MARKERS = [204, 39, 82] as const

export const LAYOUT_MODE_VALUES: LayoutMode[] = ['default', 'focus', 'minimal']

export function getLayoutModeOptions(t: TFunction) {
  return LAYOUT_MODE_VALUES.map((value) => ({
    value,
    label: t(`layout.${value}.label`),
    description: t(`layout.${value}.description`),
  }))
}

export function normalizeLayoutMode(value: unknown): LayoutMode {
  if (value === 'focus' || value === 'minimal') return value
  return 'default'
}

export function getLayoutMode(settings: AppSettings | null | undefined): LayoutMode {
  return normalizeLayoutMode(settings?.layoutMode)
}

export function isMinimalLayout(settings: AppSettings | null | undefined): boolean {
  return getLayoutMode(settings) === 'minimal'
}

export function applyLayoutFromSettings(
  settings: AppSettings,
  setSidebarCollapsed: (collapsed: boolean) => void,
): void {
  const mode = getLayoutMode(settings)
  if (mode === 'minimal') return
  setSidebarCollapsed(mode === 'focus')
}
