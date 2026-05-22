export interface SshSettings {
  /** SSH 连接断开时，对后台（非当前）SSH 终端 Tab 右下角通知 */
  alertOnDisconnect: boolean
  /** 开启后可在 SSH Tab 右键打开 SCP 文件传输面板 */
  scpTransferEnabled: boolean
}

export const DEFAULT_SSH_SETTINGS: SshSettings = {
  alertOnDisconnect: false,
  scpTransferEnabled: false,
}

export function normalizeSshSettings(value: unknown): SshSettings {
  const v = value && typeof value === 'object' ? (value as Partial<SshSettings>) : {}
  return {
    alertOnDisconnect:
      typeof v.alertOnDisconnect === 'boolean'
        ? v.alertOnDisconnect
        : DEFAULT_SSH_SETTINGS.alertOnDisconnect,
    scpTransferEnabled:
      typeof v.scpTransferEnabled === 'boolean'
        ? v.scpTransferEnabled
        : DEFAULT_SSH_SETTINGS.scpTransferEnabled,
  }
}
