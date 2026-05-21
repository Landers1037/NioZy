import { globalShortcut, BrowserWindow } from 'electron'
import type { SettingsStore } from './settings-store'

let registeredAccelerator: string | null = null

/** 窗口已可见、未最小化且拥有焦点，视为在前台展示 */
function isWindowInForeground(win: BrowserWindow): boolean {
  return win.isVisible() && !win.isMinimized() && win.isFocused()
}

function hideToBackground(win: BrowserWindow, minimizeToTrayOnClose: boolean): void {
  if (minimizeToTrayOnClose) {
    win.hide()
  } else {
    win.minimize()
  }
}

function showToForeground(win: BrowserWindow): void {
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

export function syncGlobalShortcuts(
  settingsStore: SettingsStore,
  getMainWindow: () => BrowserWindow | null,
): void {
  const accelerator = settingsStore.get().shortcuts.global.showApp
  if (registeredAccelerator && registeredAccelerator !== accelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator)
    } catch {
      /* ignore */
    }
    registeredAccelerator = null
  }

  if (!accelerator) return

  if (globalShortcut.isRegistered(accelerator)) {
    registeredAccelerator = accelerator
    return
  }

  const ok = globalShortcut.register(accelerator, () => {
    const win = getMainWindow()
    if (!win) return

    if (isWindowInForeground(win)) {
      hideToBackground(win, settingsStore.get().system.minimizeToTrayOnClose)
    } else {
      showToForeground(win)
    }
  })

  if (ok) registeredAccelerator = accelerator
}

export function unregisterGlobalShortcuts(): void {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator)
    } catch {
      /* ignore */
    }
    registeredAccelerator = null
  }
}
