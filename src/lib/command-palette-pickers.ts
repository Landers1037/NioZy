import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { COLOR_SCHEME_OPTIONS, getColorSchemeLabel } from '@/lib/terminal-themes'
import { canToggleTerminalRenderMode, setTerminalRenderer } from '@/lib/terminal-render-actions'
import { bestFuzzyScore, commandIdSearchTerms } from '@/lib/command-palette-fuzzy'
import { getAccentPresets } from '@/lib/ui-style'
import { UI_STYLE_VALUES } from '../../electron/shared/ui-style'
import type { TerminalColorScheme, ThemeMode, UiStyle } from '../../electron/shared/api-types'
import type { TerminalRenderer } from '../../electron/shared/terminal-renderer'

export type CommandPaletteSubPanelKind = 'renderMode' | 'colorScheme' | 'uiStyle' | 'themeMode'

export interface CommandPalettePickerItem {
  id: string
  label: string
  keywords: string[]
  active: boolean
}

export function getSubPanelTitle(kind: CommandPaletteSubPanelKind): string {
  if (kind === 'renderMode') return i18n.t('commandPalette.subPanel.renderMode')
  if (kind === 'colorScheme') return i18n.t('commandPalette.subPanel.colorScheme')
  if (kind === 'uiStyle') return i18n.t('commandPalette.subPanel.uiStyle')
  return i18n.t('commandPalette.subPanel.themeMode')
}

function renderModePickerItems(): CommandPalettePickerItem[] {
  const renderer = useAppStore.getState().settings?.terminal.renderer ?? 'webgl'
  const modes: TerminalRenderer[] = ['dom', 'webgl']
  return modes.map((id) => ({
    id,
    label: id === 'dom' ? i18n.t('titleBar.modeDom') : i18n.t('titleBar.modeWebgl'),
    keywords: [id, id === 'dom' ? 'dom' : 'webgl', '渲染'],
    active: renderer === id,
  }))
}

function colorSchemePickerItems(): CommandPalettePickerItem[] {
  const current = useAppStore.getState().settings?.terminal.colorScheme ?? 'atom'
  return COLOR_SCHEME_OPTIONS.map(({ id, label }) => ({
    id,
    label,
    keywords: [label, id, getColorSchemeLabel(id as TerminalColorScheme), '配色', 'theme', 'color'],
    active: current === id,
  }))
}

function uiStylePickerItems(): CommandPalettePickerItem[] {
  const current = useAppStore.getState().settings?.uiStyle ?? 'minimal'
  return UI_STYLE_VALUES.map((id) => {
    const label = i18n.t(`uiStyle.${id}.label`)
    const description = i18n.t(`uiStyle.${id}.description`)
    return {
      id,
      label,
      keywords: [label, description, id, '界面', '风格', 'style', 'ui', 'appearance'],
      active: current === id,
    }
  })
}

function themeModePickerItems(): CommandPalettePickerItem[] {
  const current = useAppStore.getState().settings?.theme ?? 'light'
  const modes: ThemeMode[] = ['light', 'dark']
  return modes.map((id) => ({
    id,
    label: i18n.t(`theme.${id}`),
    keywords: [id, id === 'light' ? '明亮' : '暗黑', 'theme', '主题'],
    active: current === id,
  }))
}

export function getPickerItems(kind: CommandPaletteSubPanelKind): CommandPalettePickerItem[] {
  if (kind === 'renderMode') return renderModePickerItems()
  if (kind === 'colorScheme') return colorSchemePickerItems()
  if (kind === 'uiStyle') return uiStylePickerItems()
  return themeModePickerItems()
}

export function listPickerItems(
  kind: CommandPaletteSubPanelKind,
  query: string,
): CommandPalettePickerItem[] {
  const items = getPickerItems(kind)
  const trimmed = query.trim()
  if (!trimmed) return items

  const filtered: { item: CommandPalettePickerItem; score: number }[] = []
  for (const item of items) {
    const score = bestFuzzyScore(trimmed, [
      item.label,
      ...item.keywords,
      ...commandIdSearchTerms(item.id),
    ])
    if (score == null) continue
    filtered.push({ item, score })
  }
  filtered.sort((a, b) => b.score - a.score)
  return filtered.map((x) => x.item)
}

export function getActivePickerIndex(items: CommandPalettePickerItem[]): number {
  const idx = items.findIndex((i) => i.active)
  return idx >= 0 ? idx : 0
}

export function canOpenSubPanel(kind: CommandPaletteSubPanelKind): boolean {
  if (kind === 'renderMode') return canToggleTerminalRenderMode()
  return useAppStore.getState().settings != null
}

export function applyPickerSelection(kind: CommandPaletteSubPanelKind, id: string): void {
  if (kind === 'renderMode') {
    setTerminalRenderer(id as TerminalRenderer)
    return
  }
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings) return
  if (kind === 'uiStyle') {
    const nextStyle = id as UiStyle
    if (nextStyle === settings.uiStyle) return
    void patchSettings({
      uiStyle: nextStyle,
      accentColor: getAccentPresets(nextStyle)[0],
    })
    return
  }
  if (kind === 'themeMode') {
    const nextTheme = id as ThemeMode
    if (nextTheme === settings.theme) return
    void patchSettings({ theme: nextTheme })
    return
  }
  void patchSettings({
    terminal: {
      ...settings.terminal,
      colorScheme: id as TerminalColorScheme,
    },
  })
}
