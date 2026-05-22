import type { TFunction } from 'i18next'
import { UI_STYLE_VALUES, type UiStyle } from '../../electron/shared/ui-style'

export function getUiStyleOptions(t: TFunction) {
  return UI_STYLE_VALUES.map((value) => ({
    value,
    label: t(`uiStyle.${value}.label`),
    description: t(`uiStyle.${value}.description`),
  }))
}

export function normalizeUiStyleOption(value: unknown): UiStyle {
  return value === 'niozy' ? 'niozy' : 'minimal'
}
