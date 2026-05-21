import type { AppTab } from '@/stores/app-store'

export function getTabDisplayTitle(tab: AppTab): string {
  return tab.customTitle?.trim() || tab.title
}

export function getTabHighlightClasses(isActive: boolean, iconOnly = false): string {
  if (!isActive) {
    return 'text-muted-foreground hover:bg-card/60 dark:hover:bg-primary/10'
  }
  if (iconOnly) {
    return 'bg-card text-foreground ring-1 ring-inset ring-border dark:bg-primary/18 dark:text-foreground dark:ring-primary/35 dark:font-medium'
  }
  return 'bg-card text-foreground shadow-sm dark:bg-primary/18 dark:text-foreground dark:shadow-none dark:ring-1 dark:ring-primary/35 dark:font-medium'
}
