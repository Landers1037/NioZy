import { app } from 'electron'
import { isElectronDev } from './is-dev'

/** release 下拦截所有 WebContents（含 webview 子页）的 DevTools */
export function installReleaseDevToolsGuard(): void {
  if (isElectronDev()) return

  app.on('web-contents-created', (_event, contents) => {
    contents.on('devtools-opened', () => {
      contents.closeDevTools()
    })
  })
}
