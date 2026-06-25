import type { AppSettings } from '../../electron/shared/api-types'
import {
  DEFAULT_ATTACH_PTY_TAB_SWITCH_DWELL_MS,
  normalizeAttachPtyTabSwitchDwellMs,
  normalizeTerminalEmulator,
} from '../../electron/shared/experimental-settings'
import type { AppTab } from '@/stores/app-store'
import { getActiveTerminalId, getSplitPanes } from '@/lib/terminal-tab-utils'

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
  return normalizeTerminalEmulator(settings.experimental.terminalEmulator) === 'xterm'
}

export function isAttachPtyWebglContextPoolEnabled(
  settings: AppSettings | null | undefined,
): boolean {
  return (
    isAttachPtyRenderMode(settings) && settings?.experimental.attachPtyWebglContextPool === true
  )
}

export function isAttachPtyScrollbackOffloadEnabled(
  settings: AppSettings | null | undefined,
): boolean {
  return (
    isAttachPtyRenderMode(settings) && settings?.experimental.attachPtyScrollbackOffload === true
  )
}

export function tabUsesAttachPtyRender(
  tab: AppTab,
  settings: AppSettings | null | undefined,
): boolean {
  if (!isAttachPtyRenderMode(settings)) return false
  if (tab.muxMode) return false
  return getSplitPanes(tab).length <= 1
}

/** 停留不足 dwell 时跳过 detach 快照，依赖主进程 pausedOutput 续流 */
export function shouldSaveAttachSnapshotOnDetach(
  session: { committedAt: number },
  dwellMs: number,
  now = Date.now(),
): boolean {
  return now - session.committedAt >= dwellMs
}

export function resolveAttachPtyTargetTab(
  activeTabId: string | null,
  tabs: AppTab[],
): AppTab | null {
  if (!activeTabId) return null
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab || tab.type !== 'terminal') return null
  if (tab.muxMode) return null
  if (getSplitPanes(tab).length > 1) return null
  const terminalId = getActiveTerminalId(tab)
  if (!terminalId) return null
  return tab
}
