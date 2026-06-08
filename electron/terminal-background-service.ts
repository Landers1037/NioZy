import { copyFile, mkdir, readdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { extname, join } from 'path'
import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { ensureConfigDir, getTerminalBackgroundDir } from './config-paths'
import { isImageFilePath } from './shared/filesystem-image'
import { buildLocalPreviewUrl } from './shared/local-file-url'

const BG_BASENAME = 'bg'

export function getTerminalBackgroundFilePath(ext: string): string {
  const normalized = ext.replace(/^\./, '').toLowerCase()
  return join(getTerminalBackgroundDir(), `${BG_BASENAME}.${normalized}`)
}

export function buildTerminalBackgroundPreviewUrl(ext: string): string {
  return buildLocalPreviewUrl(getTerminalBackgroundFilePath(ext))
}

function appendPreviewUrlCacheBust(url: string, mtimeMs: number): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${mtimeMs}`
}

/** 带文件 mtime 的预览 URL，避免同路径换图后浏览器仍显示旧缓存 */
export async function buildTerminalBackgroundPreviewUrlWithCacheBust(
  ext: string,
): Promise<string> {
  const filePath = getTerminalBackgroundFilePath(ext)
  const st = await stat(filePath)
  return appendPreviewUrlCacheBust(buildLocalPreviewUrl(filePath), st.mtimeMs)
}

async function ensureBackgroundDir(): Promise<void> {
  ensureConfigDir()
  const dir = getTerminalBackgroundDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function removeExistingBackgroundFiles(): Promise<void> {
  const dir = getTerminalBackgroundDir()
  if (!existsSync(dir)) return
  const entries = await readdir(dir)
  await Promise.all(
    entries
      .filter((name) => name.toLowerCase().startsWith(`${BG_BASENAME}.`))
      .map((name) => unlink(join(dir, name))),
  )
}

export type TerminalBackgroundPickResult =
  | { ok: true; ext: string; url: string }
  | { ok: false; canceled?: boolean; error?: string }

export async function pickAndInstallTerminalBackground(
  mainWindow: BrowserWindow | null,
): Promise<TerminalBackgroundPickResult> {
  const openOptions = {
    title: '选择终端背景图片',
    properties: ['openFile'] as ('openFile')[],
    filters: [
      {
        name: '图片',
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'],
      },
      { name: '所有文件', extensions: ['*'] },
    ],
  }
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, openOptions)
    : await dialog.showOpenDialog(openOptions)
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }

  const sourcePath = filePaths[0]
  if (!isImageFilePath(sourcePath)) {
    return { ok: false, error: 'NOT_IMAGE' }
  }

  const ext = extname(sourcePath).replace(/^\./, '').toLowerCase()
  if (!ext) return { ok: false, error: 'NO_EXTENSION' }

  try {
    await ensureBackgroundDir()
    await removeExistingBackgroundFiles()
    const destPath = getTerminalBackgroundFilePath(ext)
    await copyFile(sourcePath, destPath)
    const url = await buildTerminalBackgroundPreviewUrlWithCacheBust(ext)
    return { ok: true, ext, url }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export type TerminalBackgroundClearResult = { ok: true } | { ok: false; error?: string }

export async function clearTerminalBackgroundFiles(): Promise<TerminalBackgroundClearResult> {
  try {
    await removeExistingBackgroundFiles()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function terminalBackgroundExists(ext: string): boolean {
  return existsSync(getTerminalBackgroundFilePath(ext))
}

export function parseBackgroundExtFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase()
  const prefix = `${BG_BASENAME}.`
  if (!lower.startsWith(prefix)) return null
  const ext = fileName.slice(prefix.length).toLowerCase()
  return ext || null
}
