import { existsSync, statSync } from 'fs'
import { normalize } from 'path'
import type { BrowserWindow } from 'electron'
import { sendToRenderer } from './main/window-ipc'

let pendingOpenDirectory: string | null = null

export function parseDirectoryFromArgv(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (!arg || arg.startsWith('-')) continue
    try {
      const resolved = normalize(arg)
      if (!existsSync(resolved)) continue
      if (!statSync(resolved).isDirectory()) continue
      return resolved
    } catch {
      continue
    }
  }
  return null
}

export function setInitialOpenDirectoryFromArgv(argv: string[]): void {
  const dir = parseDirectoryFromArgv(argv)
  if (dir) pendingOpenDirectory = dir
}

export function takePendingOpenDirectory(): string | null {
  const dir = pendingOpenDirectory
  pendingOpenDirectory = null
  return dir
}

export function queueOpenDirectory(win: BrowserWindow | null, directory: string): void {
  const normalized = normalize(directory)
  if (!existsSync(normalized) || !statSync(normalized).isDirectory()) return

  if (win && !win.webContents.isLoading()) {
    sendToRenderer(win, 'app:openDirectory', normalized)
    return
  }
  pendingOpenDirectory = normalized
}

export function flushPendingOpenDirectory(win: BrowserWindow | null): void {
  if (!pendingOpenDirectory || !win || win.webContents.isLoading()) return
  sendToRenderer(win, 'app:openDirectory', pendingOpenDirectory)
  pendingOpenDirectory = null
}
