import type { LucideIcon } from 'lucide-react'
import {
  Columns2,
  Copy,
  Download,
  FolderSearch,
  Image,
  MessageSquare,
  Monitor,
  Moon,
  PackageMinus,
  PackagePlus,
  Palette,
  Pencil,
  Play,
  Settings,
  Sparkles,
  SquarePen,
  Terminal,
  TextCursor,
  X,
} from 'lucide-react'
import i18n from '@/lib/i18n'
import { useAppStore, type AppTab } from '@/stores/app-store'
import { useAiSidebarStore } from '@/stores/ai-sidebar-store'
import { createTerminal, openTerminalInDirectory } from '@/lib/terminal-actions'
import { closeTerminalTabs, exportTerminalTab } from '@/lib/tab-actions'
import { cloneTerminalTab } from '@/lib/terminal-clone-actions'
import { splitTerminalTab } from '@/lib/terminal-split-actions'
import { findGroupForTab } from '@/lib/tab-groups'
import { useTabGroupStore } from '@/stores/tab-group-store'
import { getSplitPanes, getActiveTerminalId, MAX_TERMINAL_SPLITS } from '@/lib/terminal-tab-utils'
import { canToggleTerminalRenderMode } from '@/lib/terminal-render-actions'
import { bestFuzzyScore, commandIdSearchTerms } from '@/lib/command-palette-fuzzy'
import { getRecentCommandIds } from '@/stores/command-palette-store'
import { getElectronAPI } from '@/lib/electron-client'
import { getColorSchemeLabel } from '@/lib/terminal-themes'

export type CommandPaletteCommandId =
  | 'newTerminal'
  | 'switchWorkingDirectory'
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
  | 'toggleTerminalSearch'
  | 'toggleCommandReplay'
  | 'togglePomodoro'
  | 'toggleCursorBlink'
  | 'toggleHideCursor'
  | 'toggleLigatures'
  | 'toggleRightClickCopyPaste'
  | 'toggleAdvancedRightClickMenu'
  | 'toggleSynchronizedOutput'
  | 'toggleIdleAnimation'
  | 'toggleWelcomePage'
  | 'toggleAiSidebar'
  | 'newAiChat'

export type CommandPaletteCommandGroup =
  | 'terminalSession'
  | 'terminalAppearance'
  | 'terminalBehavior'
  | 'appAppearance'
  | 'appTools'
  | 'ai'

export interface CommandPaletteCommand {
  id: CommandPaletteCommandId
  group: CommandPaletteCommandGroup
  icon: LucideIcon
  label: () => string
  keywords: () => string[]
  isEnabled: () => boolean
  leadingBadge?: () => string | undefined
  trailingHint?: () => string | undefined
}

export interface CommandPaletteListItem {
  command: CommandPaletteCommand
  score: number
  enabled: boolean
}

export type CommandPaletteExecuteResult =
  | { type: 'done' }
  | { type: 'dismissed' }
  | { type: 'dialog'; dialog: 'editTitle' | 'closeConfirm' | 'addToGroup' | 'screenshot' }
  | { type: 'subPanel'; panel: 'renderMode' | 'colorScheme' | 'uiStyle' | 'themeMode' }

const COMMAND_ORDER: CommandPaletteCommandId[] = [
  'newTerminal',
  'switchWorkingDirectory',
  'editTabTitle',
  'closeTerminalTab',
  'addTabToGroup',
  'removeTabFromGroup',
  'cloneTerminalTab',
  'splitTerminal',
  'exportTerminal',
  'terminalScreenshot',
  'toggleRenderMode',
  'selectColorScheme',
  'toggleCursorBlink',
  'toggleHideCursor',
  'toggleLigatures',
  'toggleRightClickCopyPaste',
  'toggleAdvancedRightClickMenu',
  'toggleSynchronizedOutput',
  'toggleIdleAnimation',
  'toggleWelcomePage',
  'selectUiStyle',
  'selectThemeMode',
  'openSettings',
  'toggleTerminalSearch',
  'toggleCommandReplay',
  'togglePomodoro',
  'toggleAiSidebar',
  'newAiChat',
]

function isAiSidebarEnabled(): boolean {
  return useAppStore.getState().settings?.ai.aiSidebarEnabled === true
}

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

function isLocalTerminalTab(tab: AppTab | undefined): boolean {
  return !!tab && tab.type === 'terminal' && !tab.sshConnectionId && tab.shell !== 'ssh'
}

function getFirstLocalTerminalTab(): AppTab | undefined {
  return useAppStore.getState().tabs.find((tab) => isLocalTerminalTab(tab))
}

function getTargetLocalTerminalTab(): AppTab | undefined {
  const active = getActiveTerminalTab()
  if (isLocalTerminalTab(active)) return active
  return getFirstLocalTerminalTab()
}

function getCurrentLocalTerminalCwd(): string | undefined {
  const tab = getTargetLocalTerminalTab()
  if (!tab) return undefined
  const terminalId = getActiveTerminalId(tab) ?? tab.terminalId
  if (!terminalId) return undefined
  return useAppStore.getState().terminalCwds[terminalId]
}

function getSettingStateLabel(enabled: boolean): string {
  return enabled ? i18n.t('commandPalette.states.on') : i18n.t('commandPalette.states.off')
}

function getCurrentThemeLabel(): string {
  const theme = useAppStore.getState().settings?.theme ?? 'light'
  return i18n.t(`theme.${theme}`)
}

function getCurrentUiStyleLabel(): string {
  const style = useAppStore.getState().settings?.uiStyle ?? 'minimal'
  return i18n.t(`uiStyle.${style}.label`)
}

function getCurrentColorSchemeLabel(): string {
  const colorScheme = useAppStore.getState().settings?.terminal.colorScheme ?? 'atom'
  return getColorSchemeLabel(colorScheme)
}

function getCurrentRenderModeLabel(): string {
  const renderer = useAppStore.getState().settings?.terminal.renderer ?? 'webgl'
  return renderer === 'dom' ? i18n.t('titleBar.modeDom') : i18n.t('titleBar.modeWebgl')
}

async function toggleTerminalBooleanSetting(
  key:
    | 'cursorBlink'
    | 'hideCursor'
    | 'ligaturesEnabled'
    | 'rightClickCopyPaste'
    | 'advancedRightClickMenu'
    | 'synchronizedOutputEnabled',
): Promise<void> {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings) return

  const terminalPatch = { ...settings.terminal, [key]: !settings.terminal[key] }

  if (key === 'rightClickCopyPaste' && terminalPatch.rightClickCopyPaste) {
    terminalPatch.advancedRightClickMenu = false
  }
  if (key === 'advancedRightClickMenu' && terminalPatch.advancedRightClickMenu) {
    terminalPatch.rightClickCopyPaste = false
  }

  await patchSettings({ terminal: terminalPatch })
}

async function toggleTerminalNestedBooleanSetting(
  key: 'idleAnimation' | 'welcomePage',
  childKey: 'enabled',
): Promise<void> {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings) return
  if (key === 'idleAnimation') {
    await patchSettings({
      terminal: {
        ...settings.terminal,
        idleAnimation: {
          ...settings.terminal.idleAnimation,
          [childKey]: !settings.terminal.idleAnimation[childKey],
        },
      },
    })
    return
  }
  await patchSettings({
    terminal: {
      ...settings.terminal,
      welcomePage: {
        ...settings.terminal.welcomePage,
        [childKey]: !settings.terminal.welcomePage[childKey],
      },
    },
  })
}

async function toggleAssistiveBooleanSetting(
  key: 'terminalSearchEnabled' | 'commandReplayEnabled' | 'pomodoroEnabled',
): Promise<void> {
  const { settings, patchSettings } = useAppStore.getState()
  if (!settings) return
  await patchSettings({
    assistive: {
      ...settings.assistive,
      [key]: !settings.assistive[key],
    },
  })
}

async function pickTerminalWorkingDirectoryAndOpen(): Promise<boolean> {
  const picked = await getElectronAPI().workspace.pickDirectory()
  if (!picked) return false
  await openTerminalInDirectory(picked)
  return true
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
  return [
    command.label(),
    getCommandPaletteGroupLabel(command.group),
    ...command.keywords(),
    ...commandIdSearchTerms(command.id),
  ]
}

const SHOW_ALL_COMMANDS_QUERIES = new Set(['/all', 'help', '/help'])

export function getCommandPaletteGroupLabel(group: CommandPaletteCommandGroup): string {
  return i18n.t(`commandPalette.groups.${group}`)
}

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
      group: 'terminalSession',
      icon: Terminal,
      label: () => i18n.t('commandPalette.commands.newTerminal'),
      keywords: () => ['new', 'terminal', 'shell', 'session', '新建', '终端'],
      isEnabled: () => true,
    },
    {
      id: 'switchWorkingDirectory',
      group: 'terminalSession',
      icon: FolderSearch,
      label: () => i18n.t('commandPalette.commands.switchWorkingDirectory'),
      keywords: () => ['cwd', 'directory', 'folder', 'path', 'workspace', '目录', '路径', '工作目录'],
      isEnabled: () => true,
      leadingBadge: () => getCurrentLocalTerminalCwd(),
    },
    {
      id: 'editTabTitle',
      group: 'terminalSession',
      icon: Pencil,
      label: () => i18n.t('commandPalette.commands.editTabTitle'),
      keywords: () => ['edit', 'title', 'rename', '标题', '修改'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'closeTerminalTab',
      group: 'terminalSession',
      icon: X,
      label: () => i18n.t('commandPalette.commands.closeTerminalTab'),
      keywords: () => ['close', 'tab', '关闭'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'addTabToGroup',
      group: 'terminalSession',
      icon: PackagePlus,
      label: () => i18n.t('commandPalette.commands.addTabToGroup'),
      keywords: () => ['group', 'add', '分组', '添加'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'removeTabFromGroup',
      group: 'terminalSession',
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
      group: 'terminalSession',
      icon: Copy,
      label: () => i18n.t('commandPalette.commands.cloneTerminalTab'),
      keywords: () => ['clone', 'copy', 'duplicate', '复制', '克隆'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'splitTerminal',
      group: 'terminalSession',
      icon: Columns2,
      label: () => i18n.t('commandPalette.commands.splitTerminal'),
      keywords: () => ['split', 'pane', 'layout', '拆分'],
      isEnabled: () => {
        const tab = getTargetTerminalTab()
        if (!tab) return false
        return getSplitPanes(tab).length < MAX_TERMINAL_SPLITS
      },
    },
    {
      id: 'exportTerminal',
      group: 'terminalSession',
      icon: Download,
      label: () => i18n.t('commandPalette.commands.exportTerminal'),
      keywords: () => ['export', 'save', 'text', '导出'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'terminalScreenshot',
      group: 'terminalSession',
      icon: Image,
      label: () => i18n.t('commandPalette.commands.terminalScreenshot'),
      keywords: () => ['screenshot', 'screen', 'capture', 'image', '截图', '终端截图'],
      isEnabled: () => getFirstTerminalTab() != null,
    },
    {
      id: 'toggleRenderMode',
      group: 'terminalAppearance',
      icon: Monitor,
      label: () => i18n.t('commandPalette.commands.toggleRenderMode'),
      keywords: () => ['render', 'webgl', 'dom', 'terminal settings', '渲染', '模式'],
      isEnabled: () => canToggleTerminalRenderMode(),
      trailingHint: () => getCurrentRenderModeLabel(),
    },
    {
      id: 'selectColorScheme',
      group: 'terminalAppearance',
      icon: Palette,
      label: () => i18n.t('commandPalette.commands.selectColorScheme'),
      keywords: () => ['color', 'scheme', 'theme', 'palette', '配色', '主题'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () => getCurrentColorSchemeLabel(),
    },
    {
      id: 'toggleCursorBlink',
      group: 'terminalAppearance',
      icon: TextCursor,
      label: () => i18n.t('commandPalette.commands.toggleCursorBlink'),
      keywords: () => ['cursor', 'blink', 'caret', '光标', '闪烁'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.cursorBlink === true),
    },
    {
      id: 'toggleHideCursor',
      group: 'terminalAppearance',
      icon: TextCursor,
      label: () => i18n.t('commandPalette.commands.toggleHideCursor'),
      keywords: () => ['cursor', 'hide', 'show', 'claude code', '光标', '隐藏'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.hideCursor === true),
    },
    {
      id: 'toggleLigatures',
      group: 'terminalAppearance',
      icon: Sparkles,
      label: () => i18n.t('commandPalette.commands.toggleLigatures'),
      keywords: () => ['ligatures', 'font', 'symbols', '连字', '字体'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.ligaturesEnabled === true),
    },
    {
      id: 'toggleRightClickCopyPaste',
      group: 'terminalBehavior',
      icon: Copy,
      label: () => i18n.t('commandPalette.commands.toggleRightClickCopyPaste'),
      keywords: () => ['right click', 'copy', 'paste', 'mouse', '右键', '复制', '粘贴'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.rightClickCopyPaste === true),
    },
    {
      id: 'toggleAdvancedRightClickMenu',
      group: 'terminalBehavior',
      icon: Play,
      label: () => i18n.t('commandPalette.commands.toggleAdvancedRightClickMenu'),
      keywords: () => ['right click', 'menu', 'context menu', 'mouse', '右键', '菜单'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(
          useAppStore.getState().settings?.terminal.advancedRightClickMenu === true,
        ),
    },
    {
      id: 'toggleSynchronizedOutput',
      group: 'terminalBehavior',
      icon: Columns2,
      label: () => i18n.t('commandPalette.commands.toggleSynchronizedOutput'),
      keywords: () => ['sync', 'synchronized', 'output', 'terminal', '同步输出'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(
          useAppStore.getState().settings?.terminal.synchronizedOutputEnabled === true,
        ),
    },
    {
      id: 'toggleIdleAnimation',
      group: 'terminalBehavior',
      icon: Sparkles,
      label: () => i18n.t('commandPalette.commands.toggleIdleAnimation'),
      keywords: () => ['idle', 'animation', 'terminal', 'screen saver', '闲置', '动画'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.idleAnimation.enabled === true),
    },
    {
      id: 'toggleWelcomePage',
      group: 'terminalBehavior',
      icon: Image,
      label: () => i18n.t('commandPalette.commands.toggleWelcomePage'),
      keywords: () => ['welcome', 'empty workspace', 'start page', '欢迎页'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.terminal.welcomePage.enabled === true),
    },
    {
      id: 'selectUiStyle',
      group: 'appAppearance',
      icon: Sparkles,
      label: () => i18n.t('commandPalette.commands.selectUiStyle'),
      keywords: () => ['ui', 'style', 'appearance', 'interface', '界面', '风格', '外观'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () => getCurrentUiStyleLabel(),
    },
    {
      id: 'selectThemeMode',
      group: 'appAppearance',
      icon: Moon,
      label: () => i18n.t('commandPalette.commands.selectThemeMode'),
      keywords: () => ['theme', 'light', 'dark', 'mode', '明亮', '暗黑', '主题'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () => getCurrentThemeLabel(),
    },
    {
      id: 'openSettings',
      group: 'appTools',
      icon: Settings,
      label: () => i18n.t('commandPalette.commands.openSettings'),
      keywords: () => ['settings', 'preferences', '设置'],
      isEnabled: () => true,
    },
    {
      id: 'toggleTerminalSearch',
      group: 'appTools',
      icon: FolderSearch,
      label: () => i18n.t('commandPalette.commands.toggleTerminalSearch'),
      keywords: () => ['search', 'find', 'terminal', 'assistive', '搜索', '终端搜索'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.assistive.terminalSearchEnabled === true),
    },
    {
      id: 'toggleCommandReplay',
      group: 'appTools',
      icon: Play,
      label: () => i18n.t('commandPalette.commands.toggleCommandReplay'),
      keywords: () => ['command replay', 'record', 'replay', 'assistive', '命令重放', '录制'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.assistive.commandReplayEnabled === true),
    },
    {
      id: 'togglePomodoro',
      group: 'appTools',
      icon: Play,
      label: () => i18n.t('commandPalette.commands.togglePomodoro'),
      keywords: () => ['pomodoro', 'timer', 'focus', 'assistive', '番茄钟'],
      isEnabled: () => useAppStore.getState().settings != null,
      trailingHint: () =>
        getSettingStateLabel(useAppStore.getState().settings?.assistive.pomodoroEnabled === true),
    },
    {
      id: 'toggleAiSidebar',
      group: 'ai',
      icon: MessageSquare,
      label: () => i18n.t('commandPalette.commands.toggleAiSidebar'),
      keywords: () => ['ai', 'chat', 'sidebar', 'copilot', '对话', '边栏', 'AI'],
      isEnabled: () => isAiSidebarEnabled(),
    },
    {
      id: 'newAiChat',
      group: 'ai',
      icon: SquarePen,
      label: () => i18n.t('commandPalette.commands.newAiChat'),
      keywords: () => ['ai', 'chat', 'new', 'conversation', '对话', '新建', 'AI'],
      isEnabled: () => isAiSidebarEnabled(),
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

  switch (id) {
    case 'newTerminal':
      await createTerminal()
      return { type: 'done' }
    case 'switchWorkingDirectory': {
      const opened = await pickTerminalWorkingDirectoryAndOpen()
      return opened ? { type: 'done' } : { type: 'dismissed' }
    }
    case 'editTabTitle':
      return { type: 'dialog', dialog: 'editTitle' }
    case 'closeTerminalTab':
      return { type: 'dialog', dialog: 'closeConfirm' }
    case 'addTabToGroup':
      return { type: 'dialog', dialog: 'addToGroup' }
    case 'removeTabFromGroup': {
      const tab = resolveTerminalTabForCommand()
      if (tab) useTabGroupStore.getState().removeTabFromAllGroups(tab.id)
      return { type: 'done' }
    }
    case 'cloneTerminalTab': {
      const tab = resolveTerminalTabForCommand()
      if (tab) await cloneTerminalTab(tab.id)
      return { type: 'done' }
    }
    case 'splitTerminal': {
      const tab = resolveTerminalTabForCommand()
      if (tab) await splitTerminalTab(tab.id)
      return { type: 'done' }
    }
    case 'exportTerminal': {
      const tab = resolveTerminalTabForCommand()
      if (tab) await exportTerminalTab(tab.id)
      return { type: 'done' }
    }
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
    case 'toggleTerminalSearch':
      await toggleAssistiveBooleanSetting('terminalSearchEnabled')
      return { type: 'done' }
    case 'toggleCommandReplay':
      await toggleAssistiveBooleanSetting('commandReplayEnabled')
      return { type: 'done' }
    case 'togglePomodoro':
      await toggleAssistiveBooleanSetting('pomodoroEnabled')
      return { type: 'done' }
    case 'toggleCursorBlink':
      await toggleTerminalBooleanSetting('cursorBlink')
      return { type: 'done' }
    case 'toggleHideCursor':
      await toggleTerminalBooleanSetting('hideCursor')
      return { type: 'done' }
    case 'toggleLigatures':
      await toggleTerminalBooleanSetting('ligaturesEnabled')
      return { type: 'done' }
    case 'toggleRightClickCopyPaste':
      await toggleTerminalBooleanSetting('rightClickCopyPaste')
      return { type: 'done' }
    case 'toggleAdvancedRightClickMenu':
      await toggleTerminalBooleanSetting('advancedRightClickMenu')
      return { type: 'done' }
    case 'toggleSynchronizedOutput':
      await toggleTerminalBooleanSetting('synchronizedOutputEnabled')
      return { type: 'done' }
    case 'toggleIdleAnimation':
      await toggleTerminalNestedBooleanSetting('idleAnimation', 'enabled')
      return { type: 'done' }
    case 'toggleWelcomePage':
      await toggleTerminalNestedBooleanSetting('welcomePage', 'enabled')
      return { type: 'done' }
    case 'toggleAiSidebar':
      useAiSidebarStore.getState().toggle()
      return { type: 'done' }
    case 'newAiChat': {
      const aiStore = useAiSidebarStore.getState()
      if (!aiStore.isOpen) {
        aiStore.setOpen(true)
        aiStore.setModalOpen?.(true)
      }
      aiStore.requestNewChat()
      return { type: 'done' }
    }
    default:
      return { type: 'done' }
  }
}

export function confirmCloseActiveTerminalTab(): void {
  const tab = resolveTerminalTabForCommand()
  if (!tab) return
  closeTerminalTabs([tab.id])
}
