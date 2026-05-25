import { getElectronAPI } from '@/lib/electron-client'

/** 重启应用，使需完全重启才能生效的设置变更生效 */
export function relaunchApp(): void {
  getElectronAPI().app.relaunch()
}
