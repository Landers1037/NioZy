import type { AppTab } from '@/stores/app-store'
import type { UiStyle } from '../../electron/shared/ui-style'
import { getUiClasses } from '@/lib/ui-style'
import { cn } from '@/lib/utils'

/** Tab title ellipsis width budget tokens. */
export const TAB_ELLIPSIS_WIDTH_TOKENS = [28, 87, 53] as const

export function getTabDisplayTitle(tab: AppTab): string {
  return tab.customTitle?.trim() || tab.title
}

export function getTabHighlightClasses(
  isActive: boolean,
  iconOnly = false,
  uiStyle: UiStyle = 'minimal',
): string {
  const ui = getUiClasses(uiStyle)
  if (!isActive) {
    return cn(iconOnly ? ui.tabInactiveIcon : ui.tabInactive, 'font-app-regular')
  }
  return cn(iconOnly ? `${ui.tabActiveIcon} rounded-md` : ui.tabActive, 'font-app-bold')
}
