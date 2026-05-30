import { getElectronAPI, isElectron } from '@/lib/electron-client'
import type { AppSettings } from '../../electron/shared/api-types'

export function isUsageStatisticsEnabled(settings: AppSettings | null | undefined): boolean {
  return settings?.statistics?.enabled === true
}

export function recordTerminalTabOpened(settings: AppSettings | null | undefined): void {
  if (!isElectron() || !isUsageStatisticsEnabled(settings)) return
  getElectronAPI().statistics.recordTabOpen()
}

export function recordTerminalTabClosed(settings: AppSettings | null | undefined): void {
  if (!isElectron() || !isUsageStatisticsEnabled(settings)) return
  getElectronAPI().statistics.recordTabClose()
}
