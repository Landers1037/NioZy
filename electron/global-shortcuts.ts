import { globalShortcut, BrowserWindow } from 'electron'
import type { SettingsStore } from './settings-store'
import { mainLog } from './app-log'

let registeredAccelerator: string | null = null

/** 窗口已可见、未最小化且拥有焦点，视为在前台展示 */
export function isMainWindowInForeground(win: BrowserWindow): boolean {
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

/** 与全局快捷键 showApp（默认 Ctrl+T）相同的隐藏/显示主窗口逻辑 */
export function toggleMainWindowForeground(
  getMainWindow: () => BrowserWindow | null,
  settingsStore: SettingsStore,
  source: 'shortcut' | 'pet' = 'shortcut',
): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) {
    mainLog.info('[desktop-pet] toggleMainWindowForeground: no main window', { source })
    return
  }

  const state = {
    source,
    isVisible: win.isVisible(),
    isMinimized: win.isMinimized(),
    isFocused: win.isFocused(),
    inForeground: isMainWindowInForeground(win),
    minimizeToTrayOnClose: settingsStore.get().system.minimizeToTrayOnClose,
  }

  if (isMainWindowInForeground(win)) {
    mainLog.info('[desktop-pet] toggleMainWindowForeground: hide', state)
    hideToBackground(win, settingsStore.get().system.minimizeToTrayOnClose)
  } else {
    mainLog.info('[desktop-pet] toggleMainWindowForeground: show', state)
    showToForeground(win)
    mainLog.info('[desktop-pet] toggleMainWindowForeground: after show', {
      source,
      isVisible: win.isVisible(),
      isMinimized: win.isMinimized(),
      isFocused: win.isFocused(),
    })
  }
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
    toggleMainWindowForeground(getMainWindow, settingsStore, 'shortcut')
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
