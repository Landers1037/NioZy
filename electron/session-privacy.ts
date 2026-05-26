import { app, session, type Session, type WebContents } from 'electron'

/** 终端应用不需要的 Chromium / Electron 权限（一律拒绝） */
const DENIED_PERMISSIONS = new Set<string>([
  'geolocation',
  'notifications',
  'media',
  'display-capture',
  'mediaKeySystem',
  'midi',
  'midiSysex',
  'pointerLock',
  'fullscreen',
  'idle-detection',
  'keyboardLock',
  'window-management',
  'storage-access',
  'top-level-storage-access',
  'fileSystem',
  'unknown',
])

function isDeniedPermission(permission: string): boolean {
  return DENIED_PERMISSIONS.has(permission)
}

function applySessionPermissionPolicy(ses: Session): void {
  ses.setPermissionRequestHandler(
    (_webContents: WebContents, permission: string, callback: (granted: boolean) => void) => {
      callback(!isDeniedPermission(permission))
    },
  )

  ses.setPermissionCheckHandler((_webContents, permission) => !isDeniedPermission(permission))

  ses.setDisplayMediaRequestHandler((_request, callback) => {
    callback({})
  })
}

/** 在 app.whenReady() 之前调用：禁用 Crashpad / 崩溃上报 */
export function disableCrashReporting(): void {
  app.commandLine.appendSwitch('disable-crash-reporter')
}

/** 在 app.whenReady() 之后、创建窗口之前调用 */
export function configureSessionPrivacy(): void {
  applySessionPermissionPolicy(session.defaultSession)
}
