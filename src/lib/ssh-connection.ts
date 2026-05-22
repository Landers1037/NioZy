import type { AppSettings, CustomConnection } from '../../electron/shared/api-types'
import type { AppTab } from '@/stores/app-store'

export function getSshConnection(
  settings: AppSettings | null,
  connectionId: string | undefined,
): CustomConnection | null {
  if (!settings || !connectionId) return null
  const conn = settings.connections.find((c) => c.id === connectionId && c.type === 'ssh')
  return conn ?? null
}

export function isSshTerminalTab(tab: AppTab): boolean {
  return tab.type === 'terminal' && tab.shell === 'ssh' && !!tab.sshConnectionId
}
