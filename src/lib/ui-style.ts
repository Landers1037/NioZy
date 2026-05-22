import { useMemo } from 'react'
import type { AppSettings, UiStyle } from '../../electron/shared/api-types'
import { normalizeUiStyle } from '../../electron/shared/ui-style'
import { useAppStore } from '@/stores/app-store'

export type { UiStyle }
export { UI_STYLE_VALUES, normalizeUiStyle } from '../../electron/shared/ui-style'

export const ACCENT_PRESETS_MINIMAL = ['#5C6B7A', '#8B7355', '#6B7C6E', '#7A6B8B', '#5A6E82']
export const ACCENT_PRESETS_NIOZY = ['#0A84FF', '#0066FF', '#00D2FF', '#6366F1', '#10B981']

export function getUiStyle(settings?: Pick<AppSettings, 'uiStyle'> | null): UiStyle {
  return normalizeUiStyle(settings?.uiStyle)
}

export function getAccentPresets(style: UiStyle): string[] {
  return style === 'niozy' ? ACCENT_PRESETS_NIOZY : ACCENT_PRESETS_MINIMAL
}

export interface UiClassSet {
  segmentActive: string
  segmentInactive: string
  tabActive: string
  tabActiveIcon: string
  tabInactive: string
  tabInactiveIcon: string
  sidebarBg: string
  tabBarBg: string
  segmentGroupBg: string
  mainPanel: string
  mainPanelTerminal: string
  sidebarResizeHover: string
  sidebarResizeActive: string
  titleWeight: string
  connectionEditing: string
  fontPickerSelected: string
}

export function getUiClasses(style: UiStyle): UiClassSet {
  if (style === 'niozy') {
    return {
      segmentActive:
        'bg-background font-medium text-foreground shadow-sm dark:bg-primary/18 dark:ring-1 dark:ring-primary/35',
      segmentInactive: 'text-muted-foreground hover:text-foreground',
      tabActive:
        'bg-card font-medium text-foreground shadow-sm dark:bg-primary/18 dark:text-foreground dark:shadow-none dark:ring-1 dark:ring-primary/35',
      tabActiveIcon:
        'bg-card text-foreground ring-1 ring-inset ring-border dark:bg-primary/18 dark:text-foreground dark:ring-primary/35 dark:font-medium',
      tabInactive: 'text-muted-foreground hover:bg-card/60 dark:hover:bg-primary/10',
      tabInactiveIcon: 'text-muted-foreground hover:bg-card/60 dark:hover:bg-primary/10',
      sidebarBg: 'bg-muted/50',
      tabBarBg: 'bg-muted/50',
      segmentGroupBg: 'bg-muted/50',
      mainPanel: 'rounded-xl border border-border bg-card shadow-sm',
      mainPanelTerminal: 'rounded-xl border border-border bg-transparent shadow-sm',
      sidebarResizeHover: 'hover:bg-primary/20',
      sidebarResizeActive: 'bg-primary/30',
      titleWeight: 'font-semibold',
      connectionEditing: 'rounded-lg border border-primary/40 bg-primary/5 px-3 py-2',
      fontPickerSelected: 'bg-accent font-medium',
    }
  }

  return {
    segmentActive: 'border border-border bg-card font-semibold text-foreground',
    segmentInactive: 'font-normal text-muted-foreground hover:text-foreground',
    tabActive: 'border border-border bg-card font-semibold text-foreground',
    tabActiveIcon: 'border border-border bg-card font-semibold text-foreground',
    tabInactive: 'font-normal text-muted-foreground hover:bg-muted hover:text-foreground',
    tabInactiveIcon: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    sidebarBg: 'bg-muted',
    tabBarBg: 'bg-muted',
    segmentGroupBg: 'bg-muted',
    mainPanel: 'rounded-lg border border-border bg-card',
    mainPanelTerminal: 'rounded-lg border border-border bg-transparent',
    sidebarResizeHover: 'hover:bg-muted-foreground/10',
    sidebarResizeActive: 'bg-muted-foreground/15',
    titleWeight: 'font-bold',
    connectionEditing: 'rounded-lg border border-border bg-muted px-3 py-2',
    fontPickerSelected: 'border border-border bg-card font-semibold',
  }
}

export function useUiClasses(): UiClassSet {
  const uiStyle = useAppStore((s) => getUiStyle(s.settings))
  return useMemo(() => getUiClasses(uiStyle), [uiStyle])
}

export function useUiStyle(): UiStyle {
  return useAppStore((s) => getUiStyle(s.settings))
}
