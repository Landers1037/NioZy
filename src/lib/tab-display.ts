import type { AppTab } from '@/stores/app-store'

export function getTabDisplayTitle(tab: AppTab): string {
  return tab.customTitle?.trim() || tab.title
}
