import { globalShortcut, BrowserWindow } from 'electron'
import type { SettingsStore } from './settings-store'
import { logErrorPayload, mainLog } from './app-log'
import { openScreenshotCapture } from './screenshots-service'

type GlobalShortcutId = 'showApp' | 'screenshot'

const registeredAccelerators: Partial<Record<GlobalShortcutId, string>> = {}

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

function unregisterGlobalShortcut(id: GlobalShortcutId): void {
  const accelerator = registeredAccelerators[id]
  if (!accelerator) return
  try {
    globalShortcut.unregister(accelerator)
  } catch {
    /* ignore */
  }
  delete registeredAccelerators[id]
}

function registerGlobalShortcut(id: GlobalShortcutId, accelerator: string, handler: () => void): void {
  const current = registeredAccelerators[id]
  if (current && current !== accelerator) {
    unregisterGlobalShortcut(id)
  }

  if (!accelerator) {
    unregisterGlobalShortcut(id)
    return
  }

  if (current === accelerator) return

  if (globalShortcut.isRegistered(accelerator)) {
    registeredAccelerators[id] = accelerator
    return
  }

  const ok = globalShortcut.register(accelerator, handler)
  if (ok) registeredAccelerators[id] = accelerator
}

export function syncGlobalShortcuts(
  settingsStore: SettingsStore,
  getMainWindow: () => BrowserWindow | null,
): void {
  const settings = settingsStore.get()

  registerGlobalShortcut('showApp', settings.shortcuts.global.showApp, () => {
    toggleMainWindowForeground(getMainWindow, settingsStore, 'shortcut')
  })

  const screenshotEnabled = settings.assistive.screenshotEnabled !== false
  const screenshotAccelerator = settings.shortcuts.global.screenshot
  if (screenshotEnabled && screenshotAccelerator) {
    registerGlobalShortcut('screenshot', screenshotAccelerator, () => {
      void openScreenshotCapture().catch((err) => {
        mainLog.error('Failed to start screenshot capture from global shortcut', logErrorPayload(err))
      })
    })
  } else {
    unregisterGlobalShortcut('screenshot')
  }
}

export function unregisterGlobalShortcuts(): void {
  unregisterGlobalShortcut('showApp')
  unregisterGlobalShortcut('screenshot')
}
