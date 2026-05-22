import type { BrowserWindow, WebContents } from 'electron'

export function canSendToRenderer(win: BrowserWindow | null | undefined): win is BrowserWindow {
  if (!win || win.isDestroyed()) return false
  const contents: WebContents = win.webContents
  return !contents.isDestroyed()
}

export function sendToRenderer(
  win: BrowserWindow | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (!canSendToRenderer(win)) return
  try {
    win.webContents.send(channel, ...args)
  } catch {
    /* 窗口或 webContents 可能在发送过程中被销毁 */
  }
}
