import type { AppSettings } from '../../electron/shared/api-types'
import {
  DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  normalizeAttachPtyTabSwitchDwellMs,
} from '../../electron/shared/experimental-settings'
import type { AppTab } from '@/stores/app-store'
import { getActiveTerminalId, getSplitPanes } from '@/lib/terminal-tab-utils'
import { isWtermEmulator } from '@/lib/terminal-emulator'

export function getAttachPtyTabSwitchDwellMs(
  settings: AppSettings | null | undefined,
): number {
  return normalizeAttachPtyTabSwitchDwellMs(
    settings?.experimental.attachPtyTabSwitchDwellMs ??
      DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  )
}

export function isAttachPtyRenderMode(settings: AppSettings | null | undefined): boolean {
  if (!settings?.experimental.attachPtyRenderMode) return false
  return !isWtermEmulator(settings)
}

export function tabUsesAttachPtyRender(
  tab: AppTab,
  settings: AppSettings | null | undefined,
): boolean {
  if (!isAttachPtyRenderMode(settings)) return false
  return getSplitPanes(tab).length <= 1
}

export function resolveAttachPtyTargetTab(
  activeTabId: string | null,
  tabs: AppTab[],
): AppTab | null {
  if (!activeTabId) return null
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab || tab.type !== 'terminal') return null
  if (getSplitPanes(tab).length > 1) return null
  const terminalId = getActiveTerminalId(tab)
  if (!terminalId) return null
  return tab
}
