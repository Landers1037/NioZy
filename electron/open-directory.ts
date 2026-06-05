import { existsSync, statSync } from 'fs'
import { normalize } from 'path'
import type { BrowserWindow } from 'electron'
import type { AppOpenDirectoryPayload } from './shared/api-types'
import { sendToRenderer } from './main/window-ipc'

export const CONNECTION_ARG_PREFIX = '--niozy-connection='

let pendingOpenRequest: AppOpenDirectoryPayload | null = null

export function parseConnectionIdFromArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (!arg?.startsWith(CONNECTION_ARG_PREFIX)) continue
    const id = arg.slice(CONNECTION_ARG_PREFIX.length).trim()
    if (id) return id
  }
  return null
}

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

export function parseOpenRequestFromArgv(argv: string[]): AppOpenDirectoryPayload | null {
  const directory = parseDirectoryFromArgv(argv)
  if (!directory) return null
  const connectionId = parseConnectionIdFromArgv(argv) ?? undefined
  return { directory, connectionId }
}

export function setInitialOpenDirectoryFromArgv(argv: string[]): void {
  const request = parseOpenRequestFromArgv(argv)
  if (request) pendingOpenRequest = request
}

export function takePendingOpenDirectory(): AppOpenDirectoryPayload | null {
  const request = pendingOpenRequest
  pendingOpenRequest = null
  return request
}

export function queueOpenDirectory(
  win: BrowserWindow | null,
  directory: string,
  connectionId?: string,
): void {
  const normalized = normalize(directory)
  if (!existsSync(normalized) || !statSync(normalized).isDirectory()) return

  const payload: AppOpenDirectoryPayload = {
    directory: normalized,
    ...(connectionId ? { connectionId } : {}),
  }

  if (win && !win.webContents.isLoading()) {
    sendToRenderer(win, 'app:openDirectory', payload)
    return
  }
  pendingOpenRequest = payload
}

export function flushPendingOpenDirectory(win: BrowserWindow | null): void {
  if (!pendingOpenRequest || !win || win.webContents.isLoading()) return
  sendToRenderer(win, 'app:openDirectory', pendingOpenRequest)
  pendingOpenRequest = null
}
