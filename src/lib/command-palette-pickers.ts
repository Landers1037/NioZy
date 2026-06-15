import i18n from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { COLOR_SCHEME_OPTIONS, getColorSchemeLabel } from '@/lib/terminal-themes'
import { canToggleTerminalRenderMode, setTerminalRenderer } from '@/lib/terminal-render-actions'
import { bestFuzzyScore, commandIdSearchTerms } from '@/lib/command-palette-fuzzy'
import type { TerminalColorScheme } from '../../electron/shared/api-types'
import type { TerminalRenderer } from '../../electron/shared/terminal-renderer'

export type CommandPaletteSubPanelKind = 'renderMode' | 'colorScheme'

export interface CommandPalettePickerItem {
  id: string
  label: string
  keywords: string[]
  active: boolean
}

export function getSubPanelTitle(kind: CommandPaletteSubPanelKind): string {
  if (kind === 'renderMode') return i18n.t('commandPalette.subPanel.renderMode')
  return i18n.t('commandPalette.subPanel.colorScheme')
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

export function getPickerItems(kind: CommandPaletteSubPanelKind): CommandPalettePickerItem[] {
  if (kind === 'renderMode') return renderModePickerItems()
  return colorSchemePickerItems()
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
  void patchSettings({
    terminal: {
      ...settings.terminal,
      colorScheme: id as TerminalColorScheme,
    },
  })
}
