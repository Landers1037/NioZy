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
export const ACCENT_PRESETS_WAFU = [
  '#C8556D',
  '#4A6670',
  '#6B8F71',
  '#B8860B',
  '#5D2E46',
]
export const ACCENT_PRESETS_CYBERPUNK = [
  '#FCEE0A',
  '#00F0FF',
  '#FF2A6D',
  '#BD00FF',
  '#39FF14',
]

export function getUiStyle(settings?: Pick<AppSettings, 'uiStyle'> | null): UiStyle {
  return normalizeUiStyle(settings?.uiStyle)
}

export function getAccentPresets(style: UiStyle): string[] {
  if (style === 'niozy') return ACCENT_PRESETS_NIOZY
  if (style === 'windowsClassic') return ACCENT_PRESETS_WINDOWS_CLASSIC
  if (style === 'waFu') return ACCENT_PRESETS_WAFU
  if (style === 'cyberpunk') return ACCENT_PRESETS_CYBERPUNK
  return ACCENT_PRESETS_MINIMAL
}

export function getTabCornerRadius(style: UiStyle): string {
  if (style === 'niozy') return 'rounded-[10px]'
  if (style === 'windowsClassic') return 'rounded-none'
  if (style === 'waFu') return 'rounded-md'
  if (style === 'cyberpunk') return 'rounded-sm'
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
        'bg-background text-foreground shadow-sm dark:bg-primary/18 dark:ring-1 dark:ring-primary/35',
      segmentInactive: 'text-muted-foreground hover:text-foreground',
      tabActive:
        'bg-card text-foreground shadow-sm dark:bg-primary/18 dark:text-foreground dark:shadow-none dark:ring-1 dark:ring-primary/35',
      tabActiveIcon:
        'bg-card text-foreground ring-1 ring-inset ring-border dark:bg-primary/18 dark:text-foreground dark:ring-primary/35',
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
      titleWeight: 'font-app-bold',
      windowControlBtn: 'rounded-none hover:bg-muted',
      windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white',
      statusBar: 'h-8 border-t border-border bg-card px-3 gap-3',
      statusTag: '',
      connectionEditing: 'rounded-lg border border-primary/40 bg-primary/5 px-3 py-2',
      fontPickerSelected: 'bg-accent font-app-bold',
    }
  }

  if (style === 'cyberpunk') {
    return {
      segmentActive:
        'border border-primary/45 bg-primary/10 text-foreground shadow-[0_0_10px_rgb(252_238_10/0.2)] dark:border-[#00f0ff]/45 dark:bg-[#00f0ff]/10 dark:shadow-[0_0_12px_rgb(0_240_255/0.25)]',
      segmentInactive: 'text-muted-foreground hover:text-primary hover:bg-primary/5',
      tabActive:
        'border border-primary/50 bg-card text-foreground shadow-[0_0_12px_rgb(252_238_10/0.22)] dark:border-[#00f0ff]/50 dark:bg-[#00f0ff]/8 dark:shadow-[0_0_14px_rgb(0_240_255/0.28)]',
      tabActiveIcon:
        'border border-primary/50 bg-card text-foreground dark:border-[#00f0ff]/50 dark:bg-[#00f0ff]/8 dark:shadow-[0_0_10px_rgb(0_240_255/0.22)]',
      tabInactive: 'text-muted-foreground hover:text-primary hover:bg-primary/5 dark:hover:bg-[#00f0ff]/6',
      tabInactiveIcon:
        'text-muted-foreground hover:text-primary hover:bg-primary/5 dark:hover:bg-[#00f0ff]/6',
      sidebarBg: 'bg-muted/80 dark:bg-[#0e0e18]',
      tabBarBg: 'bg-muted/80 dark:bg-[#0e0e18]',
      segmentGroupBg: 'bg-muted/80 border border-border/80 dark:bg-[#0e0e18] dark:border-[#00f0ff]/15',
      mainPanel:
        'ui-cyber-panel rounded-sm border border-primary/25 bg-card shadow-[0_0_18px_rgb(0_240_255/0.06)] dark:border-[#00f0ff]/20 dark:shadow-[0_0_22px_rgb(0_240_255/0.1)]',
      mainPanelTerminal:
        'ui-cyber-panel rounded-sm border border-primary/25 bg-transparent shadow-[0_0_18px_rgb(0_240_255/0.06)] dark:border-[#00f0ff]/20 dark:shadow-[0_0_22px_rgb(0_240_255/0.1)]',
      sidebarResizeHover: 'hover:bg-primary/20 dark:hover:bg-[#00f0ff]/15',
      sidebarResizeActive: 'bg-primary/30 dark:bg-[#00f0ff]/22',
      titleBar: 'ui-cyber-titlebar h-10 border-b border-primary/30 bg-card dark:border-[#00f0ff]/25',
      titleTagline: 'text-xs text-muted-foreground tracking-wide',
      titleWeight: 'font-app-bold tracking-wider uppercase',
      windowControlBtn: 'rounded-none hover:bg-primary/15 dark:hover:bg-[#00f0ff]/12',
      windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white hover:shadow-[0_0_10px_rgb(255_42_109/0.45)]',
      statusBar:
        'ui-cyber-statusbar h-8 border-t border-primary/25 bg-card/95 px-3 gap-3 dark:border-[#00f0ff]/20 dark:bg-[#0e0e18]/95',
      statusTag: '',
      connectionEditing:
        'rounded-sm border border-primary/40 bg-primary/8 px-3 py-2 shadow-[0_0_8px_rgb(252_238_10/0.12)] dark:border-[#00f0ff]/35 dark:bg-[#00f0ff]/6',
      fontPickerSelected: 'border border-primary/40 bg-primary/10 font-app-bold dark:border-[#00f0ff]/40',
    }
  }

  if (style === 'waFu') {
    return {
      segmentActive:
        'border border-primary/25 bg-card text-foreground shadow-[0_1px_2px_rgb(200_85_109/0.08)] dark:border-primary/30 dark:bg-primary/12',
      segmentInactive: 'text-muted-foreground hover:text-foreground',
      tabActive:
        'border border-primary/30 bg-card text-foreground shadow-[0_1px_3px_rgb(200_85_109/0.1)] dark:border-primary/35 dark:bg-primary/14',
      tabActiveIcon:
        'border border-primary/30 bg-card text-foreground dark:border-primary/35 dark:bg-primary/14',
      tabInactive: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      tabInactiveIcon: 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
      sidebarBg: 'bg-muted/70',
      tabBarBg: 'bg-muted/70',
      segmentGroupBg: 'bg-muted/70',
      mainPanel: 'rounded-lg border border-border bg-card shadow-[0_1px_4px_rgb(61_52_40/0.06)]',
      mainPanelTerminal:
        'rounded-lg border border-border bg-transparent shadow-[0_1px_4px_rgb(61_52_40/0.06)]',
      sidebarResizeHover: 'hover:bg-primary/15',
      sidebarResizeActive: 'bg-primary/22',
      titleBar: 'h-10 border-b border-border bg-card/95',
      titleTagline: 'text-xs text-muted-foreground',
      titleWeight: 'font-app-bold tracking-wide',
      windowControlBtn: 'rounded-none hover:bg-muted',
      windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white',
      statusBar: 'h-8 border-t border-border bg-card/95 px-3 gap-3',
      statusTag: '',
      connectionEditing: 'rounded-md border border-primary/30 bg-primary/5 px-3 py-2',
      fontPickerSelected: 'border border-primary/25 bg-card font-app-bold',
    }
  }

  if (style === 'windowsClassic') {
    return {
      segmentActive: 'ui-xp-inset rounded-none px-3 py-1 text-[11px] text-foreground',
      segmentInactive:
        'rounded-none px-3 py-1 text-[11px] text-foreground hover:bg-[#d4d0c8]',
      tabActive: 'ui-xp-tab-active rounded-none px-2 py-1 text-[11px] text-foreground',
      tabActiveIcon: 'ui-xp-tab-active size-6 shrink-0 justify-center rounded-none',
      tabInactive:
        'rounded-none text-[11px] text-foreground hover:bg-[#d4d0c8] dark:hover:bg-[#4a4a4a]',
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
      titleWeight: 'font-app-bold text-sm text-white drop-shadow-sm',
      windowControlBtn: 'ui-xp-caption-btn rounded-none hover:bg-[#3c8ef0]',
      windowCloseBtn: 'ui-xp-caption-btn ui-xp-caption-btn-close rounded-none',
      statusBar: 'ui-xp-statusbar h-[22px] shrink-0 gap-1 px-1 border-0',
      statusTag: 'ui-xp-status-field',
      connectionEditing: 'ui-xp-inset rounded-none bg-card px-3 py-2',
      fontPickerSelected: 'ui-xp-inset rounded-none font-app-bold bg-card',
    }
  }

  return {
    segmentActive: 'border border-border bg-card text-foreground',
    segmentInactive: 'text-muted-foreground hover:text-foreground',
    tabActive: 'border border-border bg-card text-foreground',
    tabActiveIcon: 'border border-border bg-card text-foreground',
    tabInactive: 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
    titleWeight: 'font-app-bold',
    windowControlBtn: 'rounded-none hover:bg-muted',
    windowCloseBtn: 'rounded-none hover:bg-destructive hover:text-white',
    statusBar: 'h-8 border-t border-border bg-card px-3 gap-3',
    statusTag: '',
    connectionEditing: 'rounded-lg border border-border bg-muted px-3 py-2',
    fontPickerSelected: 'border border-border bg-card font-app-bold',
  }
}

export function useUiClasses(): UiClassSet {
  const uiStyle = useAppStore((s) => getUiStyle(s.settings))
  return useMemo(() => getUiClasses(uiStyle), [uiStyle])
}

export function useUiStyle(): UiStyle {
  return useAppStore((s) => getUiStyle(s.settings))
}
