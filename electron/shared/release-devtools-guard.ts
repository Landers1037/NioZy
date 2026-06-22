import type { WebContents } from 'electron'
import { app } from 'electron'
import { isElectronDev } from './is-dev'

const devToolsAllowedIds = new Set<number>()

/** 放行指定 WebContents 打开 DevTools（如托盘菜单主动打开主窗口） */
export function allowDevToolsForContents(contents: WebContents): void {
  devToolsAllowedIds.add(contents.id)
}

/** release 下拦截未授权的 DevTools（含 webview 子页）；托盘菜单打开的除外 */
export function installReleaseDevToolsGuard(): void {
  if (isElectronDev()) return

  app.on('web-contents-created', (_event, contents) => {
    contents.on('devtools-opened', () => {
      if (devToolsAllowedIds.has(contents.id)) return
      contents.closeDevTools()
    })
    contents.on('destroyed', () => {
      devToolsAllowedIds.delete(contents.id)
    })
  })
}
