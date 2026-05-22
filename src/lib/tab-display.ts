import type { AppTab } from '@/stores/app-store'
import type { UiStyle } from '../../electron/shared/ui-style'
import { getUiClasses } from '@/lib/ui-style'

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
    return iconOnly ? ui.tabInactiveIcon : ui.tabInactive
  }
  return iconOnly ? `${ui.tabActiveIcon} rounded-md` : ui.tabActive
}
