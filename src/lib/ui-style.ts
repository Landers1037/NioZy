import { useMemo } from 'react'
import type { AppSettings, UiStyle } from '../../electron/shared/api-types'
import { normalizeUiStyle } from '../../electron/shared/ui-style'
import { useAppStore } from '@/stores/app-store'

export type { UiStyle }
export {
  UI_STYLE_VALUES,
  normalizeUiStyle,
  uiStyleToDataAttribute,
} from '../../electron/shared/ui-style'

export const ACCENT_PRESETS_MINIMAL = ['#5C6B7A', '#8B7355', '#6B7C6E', '#7A6B8B', '#5A6E82']
export const ACCENT_PRESETS_NIOZY = ['#0A84FF', '#0066FF', '#00D2FF', '#6366F1', '#10B981']
export const ACCENT_PRESETS_WINDOWS_CLASSIC = [
  '#0054E3',
  '#008000',
  '#800080',
  '#808000',
  '#C0C0C0',
]

export function getUiStyle(settings?: Pick<AppSettings, 'uiStyle'> | null): UiStyle {
  return normalizeUiStyle(settings?.uiStyle)
}

export function getAccentPresets(style: UiStyle): string[] {
  if (style === 'niozy') return ACCENT_PRESETS_NIOZY
  if (style === 'windowsClassic') return ACCENT_PRESETS_WINDOWS_CLASSIC
  return ACCENT_PRESETS_MINIMAL
}

export function getTabCornerRadius(style: UiStyle): string {
  if (style === 'niozy') return 'rounded-[10px]'
  if (style === 'windowsClassic') return 'rounded-none'
  return 'rounded-lg'
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
  titleBar: string
  titleTagline: string
  titleWeight: string
  windowControlBtn: string
  windowCloseBtn: string
  statusBar: string
  statusTag: string
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
      titleBar: 'h-10 border-b border-border bg-card',
      titleTagline: 'text-xs text-muted-foreground',
      titleWeight: 'font-semibold',
      windowControlBtn: 'rounded-none hover:bg-muted',
      windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white',
      statusBar: 'h-8 border-t border-border bg-card px-3 gap-3',
      statusTag: '',
      connectionEditing: 'rounded-lg border border-primary/40 bg-primary/5 px-3 py-2',
      fontPickerSelected: 'bg-accent font-medium',
    }
  }

  if (style === 'windowsClassic') {
    return {
      segmentActive: 'ui-xp-inset rounded-none px-3 py-1 text-[11px] font-bold text-foreground',
      segmentInactive:
        'rounded-none px-3 py-1 text-[11px] font-normal text-foreground hover:bg-[#d4d0c8]',
      tabActive: 'ui-xp-tab-active rounded-none px-2 py-1 text-[11px] font-bold text-foreground',
      tabActiveIcon: 'ui-xp-tab-active size-6 shrink-0 justify-center rounded-none',
      tabInactive:
        'rounded-none text-[11px] font-normal text-foreground hover:bg-[#d4d0c8] dark:hover:bg-[#4a4a4a]',
      tabInactiveIcon:
        'rounded-none text-foreground hover:bg-[#d4d0c8] dark:hover:bg-[#4a4a4a]',
      sidebarBg: 'bg-[#d4d0c8] dark:bg-[#3a3a3a]',
      tabBarBg: 'bg-[#ece9d8] dark:bg-[#2a2a2a] ui-xp-tab-strip',
      segmentGroupBg: 'ui-xp-outset rounded-none p-0.5 gap-0',
      mainPanel: 'rounded-none ui-xp-inset bg-card min-h-0',
      mainPanelTerminal: 'rounded-none ui-xp-inset bg-transparent min-h-0',
      sidebarResizeHover: 'hover:bg-[#0054e3]/25',
      sidebarResizeActive: 'bg-[#0054e3]/35',
      titleBar: 'ui-xp-titlebar h-[30px] shrink-0 border-0',
      titleTagline: 'text-[11px] text-white/90',
      titleWeight: 'font-bold text-sm text-white drop-shadow-sm',
      windowControlBtn: 'ui-xp-caption-btn rounded-none hover:bg-[#3c8ef0]',
      windowCloseBtn: 'ui-xp-caption-btn ui-xp-caption-btn-close rounded-none',
      statusBar: 'ui-xp-statusbar h-[22px] shrink-0 gap-1 px-1 border-0',
      statusTag: 'ui-xp-status-field',
      connectionEditing: 'ui-xp-inset rounded-none bg-card px-3 py-2',
      fontPickerSelected: 'ui-xp-inset rounded-none font-bold bg-card',
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
    titleBar: 'h-10 border-b border-border bg-card',
    titleTagline: 'text-xs text-muted-foreground',
    titleWeight: 'font-bold',
    windowControlBtn: 'rounded-none hover:bg-muted',
    windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white',
    statusBar: 'h-8 border-t border-border bg-card px-3 gap-3',
    statusTag: '',
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
