import type { LucideIcon } from 'lucide-react'
import {
  Columns2,
  Copy,
  Download,
  Image,
  Monitor,
  Moon,
  PackageMinus,
  PackagePlus,
  Palette,
  Pencil,
  Settings,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import i18n from '@/lib/i18n'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { createTerminal } from '@/lib/terminal-actions'
import { closeTerminalTabs, exportTerminalTab } from '@/lib/tab-actions'
import { cloneTerminalTab } from '@/lib/terminal-clone-actions'
import { splitTerminalTab } from '@/lib/terminal-split-actions'
import { findGroupForTab } from '@/lib/tab-groups'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { getSplitPanes, MAX_TERMINAL_SPLITS } from '@/lib/terminal-tab-utils'
import { canToggleTerminalRenderMode } from '@/lib/terminal-render-actions'
import { bestFuzzyScore, commandIdSearchTerms } from '@/lib/command-palette-fuzzy'
import { getRecentCommandIds } from '@/stores/command-palette-store'

export type CommandPaletteCommandId =
  | 'newTerminal'
  | 'editTabTitle'
  | 'closeTerminalTab'
  | 'addTabToGroup'
  | 'removeTabFromGroup'
  | 'cloneTerminalTab'
  | 'splitTerminal'
  | 'exportTerminal'
  | 'terminalScreenshot'
  | 'openSettings'
  | 'toggleRenderMode'
  | 'selectColorScheme'
  | 'selectUiStyle'
  | 'selectThemeMode'

export interface CommandPaletteCommand {
  id: CommandPaletteCommandId
  icon: LucideIcon
  label: () => string
  keywords: () => string[]
  isEnabled: () => boolean
}

export interface CommandPaletteListItem {
  command: CommandPaletteCommand
  score: number
  enabled: boolean
}

export type CommandPaletteExecuteResult =
  | { type: 'done' }
  | { type: 'dialog'; dialog: 'editTitle' | 'closeConfirm' | 'addToGroup' | 'screenshot' }
  | { type: 'subPanel'; panel: 'renderMode' | 'colorScheme' | 'uiStyle' | 'themeMode' }

const COMMAND_ORDER: CommandPaletteCommandId[] = [
  'newTerminal',
  'editTabTitle',
  'closeTerminalTab',
  'addTabToGroup',
  'removeTabFromGroup',
  'cloneTerminalTab',
  'splitTerminal',
  'exportTerminal',
  'terminalScreenshot',
  'openSettings',
  'toggleRenderMode',
  'selectColorScheme',
  'selectUiStyle',
  'selectThemeMode',
]

function getActiveTerminalTab(): AppTab | undefined {
  const { tabs, activeTabId } = useAppStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId)
  return tab?.type === 'terminal' ? tab : undefined
}

function getFirstTerminalTab(): AppTab | undefined {
  return useAppStore.getState().tabs.find((t) => t.type === 'terminal')
}

function getTargetTerminalTab(): AppTab | undefined {
  return getActiveTerminalTab() ?? getFirstTerminalTab()
}

/** 执行终端相关命令时解析目标 Tab：优先当前活动终端，否则取第一个终端 Tab 并激活 */
export function resolveTerminalTabForCommand(): AppTab | undefined {
  const active = getActiveTerminalTab()
  if (active) return active
  const first = getFirstTerminalTab()
  if (first) {
    useAppStore.getState().setActiveTab(first.id)
    return first
  }
  return undefined
}

function commandSearchTexts(command: CommandPaletteCommand): string[] {
  return [command.label(), ...command.keywords(), ...commandIdSearchTerms(command.id)]
}

const SHOW_ALL_COMMANDS_QUERIES = new Set(['/all', 'help', '/help'])

/** 输入 /all、help 或 /help 时展示全部命令列表 */
export function isShowAllCommandsQuery(query: string): boolean {
  return SHOW_ALL_COMMANDS_QUERIES.has(query.trim().toLowerCase())
}

function listAllCommandPaletteItems(commands: CommandPaletteCommand[]): CommandPaletteListItem[] {
  const items: CommandPaletteListItem[] = []
  for (const id of COMMAND_ORDER) {
    const command = commands.find((c) => c.id === id)
    if (!command) continue
    items.push({ command, score: 0, enabled: command.isEnabled() })
  }
  items.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return COMMAND_ORDER.indexOf(a.command.id) - COMMAND_ORDER.indexOf(b.command.id)
  })
  return items
}

function buildCommands(): CommandPaletteCommand[] {
  return [
    {
      id: 'newTerminal',
      icon: Terminal,
      label: () => i18n.t('commandPalette.commands.newTerminal'),
      keywords: () => ['new', 'terminal', '新建', '终端'],
      isEnabled: () => true,
    },
    {
      id: 'editTabTitle',
      icon: Pencil,
      label: () => i18n.t('commandPalette.commands.editTabTitle'),
      keywords: () => ['edit', 'title', 'rename', '标题', '修改'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'closeTerminalTab',
      icon: X,
      label: () => i18n.t('commandPalette.commands.closeTerminalTab'),
      keywords: () => ['close', 'tab', '关闭'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'addTabToGroup',
      icon: PackagePlus,
      label: () => i18n.t('commandPalette.commands.addTabToGroup'),
      keywords: () => ['group', 'add', '分组', '添加'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'removeTabFromGroup',
      icon: PackageMinus,
      label: () => i18n.t('commandPalette.commands.removeTabFromGroup'),
      keywords: () => ['group', 'remove', '分组', '移出'],
      isEnabled: () => {
        const tab = getTargetTerminalTab()
        if (!tab) return false
        return findGroupForTab(useTabGroupStore.getState().groups, tab.id) != null
      },
    },
    {
      id: 'cloneTerminalTab',
      icon: Copy,
      label: () => i18n.t('commandPalette.commands.cloneTerminalTab'),
      keywords: () => ['clone', 'copy', '复制', '克隆'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'splitTerminal',
      icon: Columns2,
      label: () => i18n.t('commandPalette.commands.splitTerminal'),
      keywords: () => ['split', 'pane', '拆分'],
      isEnabled: () => {
        const tab = getTargetTerminalTab()
        if (!tab) return false
        return getSplitPanes(tab).length < MAX_TERMINAL_SPLITS
      },
    },
    {
      id: 'exportTerminal',
      icon: Download,
      label: () => i18n.t('commandPalette.commands.exportTerminal'),
      keywords: () => ['export', 'save', '导出'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'terminalScreenshot',
      icon: Image,
      label: () => i18n.t('commandPalette.commands.terminalScreenshot'),
      keywords: () => ['screenshot', 'screen', 'sc', 'capture', 'snap', 'image', '截图', '终端截图'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'openSettings',
      icon: Settings,
      label: () => i18n.t('commandPalette.commands.openSettings'),
      keywords: () => ['settings', 'preferences', '设置'],
      isEnabled: () => true,
    },
    {
      id: 'toggleRenderMode',
      icon: Monitor,
      label: () => i18n.t('commandPalette.commands.toggleRenderMode'),
      keywords: () => ['render', 'webgl', 'dom', '渲染', '模式'],
      isEnabled: () => canToggleTerminalRenderMode(),
    },
    {
      id: 'selectColorScheme',
      icon: Palette,
      label: () => i18n.t('commandPalette.commands.selectColorScheme'),
      keywords: () => ['color', 'scheme', 'theme', 'palette', '配色', '主题'],
      isEnabled: () => useAppStore.getState().settings != null,
    },
    {
      id: 'selectUiStyle',
      icon: Sparkles,
      label: () => i18n.t('commandPalette.commands.selectUiStyle'),
      keywords: () => ['ui', 'style', 'appearance', 'interface', '界面', '风格', '外观'],
      isEnabled: () => useAppStore.getState().settings != null,
    },
    {
      id: 'selectThemeMode',
      icon: Moon,
      label: () => i18n.t('commandPalette.commands.selectThemeMode'),
      keywords: () => ['theme', 'light', 'dark', 'mode', '明亮', '暗黑', '主题'],
      isEnabled: () => useAppStore.getState().settings != null,
    },
  ]
}

export function getCommandPaletteCommands(): CommandPaletteCommand[] {
  return buildCommands()
}

export function getCommandById(id: CommandPaletteCommandId): CommandPaletteCommand | undefined {
  return getCommandPaletteCommands().find((c) => c.id === id)
}

export function listCommandPaletteItems(query: string): CommandPaletteListItem[] {
  const commands = getCommandPaletteCommands()
  const trimmed = query.trim()

  if (!trimmed) {
    const recentIds = getRecentCommandIds()
    const recentItems: CommandPaletteListItem[] = []
    for (const id of recentIds) {
      const command = commands.find((c) => c.id === id)
      if (command?.isEnabled()) {
        recentItems.push({ command, score: 10000, enabled: true })
      }
    }
    if (recentItems.length >= 3) return recentItems.slice(0, 3)

    const fallback: CommandPaletteListItem[] = []
    for (const id of COMMAND_ORDER) {
      if (fallback.length >= 3) break
      const command = commands.find((c) => c.id === id)
      if (command?.isEnabled() && !recentItems.some((r) => r.command.id === id)) {
        fallback.push({ command, score: 0, enabled: true })
      }
    }
    return [...recentItems, ...fallback].slice(0, 3)
  }

  if (isShowAllCommandsQuery(trimmed)) {
    return listAllCommandPaletteItems(commands)
  }

  const items: CommandPaletteListItem[] = []
  for (const command of commands) {
    const score = bestFuzzyScore(trimmed, commandSearchTexts(command))
    if (score == null) continue
    const enabled = command.isEnabled()
    items.push({ command, score, enabled })
  }
  items.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return b.score - a.score || COMMAND_ORDER.indexOf(a.command.id) - COMMAND_ORDER.indexOf(b.command.id)
  })
  return items
}

export async function executeCommandPaletteCommand(
  id: CommandPaletteCommandId,
): Promise<CommandPaletteExecuteResult | { type: 'unavailable' }> {
  const command = getCommandById(id)
  if (!command?.isEnabled()) return { type: 'unavailable' }

  const tab = resolveTerminalTabForCommand()

  switch (id) {
    case 'newTerminal':
      await createTerminal()
      return { type: 'done' }
    case 'editTabTitle':
      return { type: 'dialog', dialog: 'editTitle' }
    case 'closeTerminalTab':
      return { type: 'dialog', dialog: 'closeConfirm' }
    case 'addTabToGroup':
      return { type: 'dialog', dialog: 'addToGroup' }
    case 'removeTabFromGroup':
      if (tab) useTabGroupStore.getState().removeTabFromAllGroups(tab.id)
      return { type: 'done' }
    case 'cloneTerminalTab':
      if (tab) await cloneTerminalTab(tab.id)
      return { type: 'done' }
    case 'splitTerminal':
      if (tab) await splitTerminalTab(tab.id)
      return { type: 'done' }
    case 'exportTerminal':
      if (tab) await exportTerminalTab(tab.id)
      return { type: 'done' }
    case 'terminalScreenshot':
      return { type: 'dialog', dialog: 'screenshot' }
    case 'openSettings':
      useAppStore.getState().addSettingsTab()
      return { type: 'done' }
    case 'toggleRenderMode':
      return { type: 'subPanel', panel: 'renderMode' }
    case 'selectColorScheme':
      return { type: 'subPanel', panel: 'colorScheme' }
    case 'selectUiStyle':
      return { type: 'subPanel', panel: 'uiStyle' }
    case 'selectThemeMode':
      return { type: 'subPanel', panel: 'themeMode' }
    default:
      return { type: 'done' }
  }
}

export function confirmCloseActiveTerminalTab(): void {
  const tab = resolveTerminalTabForCommand()
  if (!tab) return
  closeTerminalTabs([tab.id])
}
