import { copyFile, mkdir, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { extname, join } from 'path'
import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { ensureReminderDir, getReminderDir, getReminderImagePath } from './config-paths'
import { isImageFilePath } from './shared/filesystem-image'
import { buildLocalPreviewUrl } from './shared/local-file-url'

const IMAGE_BASENAME = 'reminder'
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif'])

export function buildReminderImagePreviewUrl(ext: string): string {
  return buildLocalPreviewUrl(getReminderImagePath(ext))
}

async function ensureDir(): Promise<void> {
  ensureReminderDir()
  const dir = getReminderDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function removeExistingImageFiles(): Promise<void> {
  const dir = getReminderDir()
  if (!existsSync(dir)) return
  const entries = await readdir(dir)
  await Promise.all(
    entries
      .filter((name) => name.toLowerCase().startsWith(`${IMAGE_BASENAME}.`))
      .map((name) => unlink(join(dir, name))),
  )
}

export type ReminderImagePickResult =
  | { ok: true; ext: string; url: string }
  | { ok: false; canceled?: boolean; error?: string }

export async function pickAndInstallReminderImage(
  mainWindow: BrowserWindow | null,
): Promise<ReminderImagePickResult> {
  const openOptions = {
    title: '选择提醒图片',
    properties: ['openFile'] as ('openFile')[],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
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

  let ext = extname(sourcePath).replace(/^\./, '').toLowerCase()
  if (ext === 'jpeg') ext = 'jpg'
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: 'INVALID_EXTENSION' }
  }

  try {
    await ensureDir()
    await removeExistingImageFiles()
    const destPath = getReminderImagePath(ext)
    await copyFile(sourcePath, destPath)
    return { ok: true, ext, url: buildReminderImagePreviewUrl(ext) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export type ReminderImageClearResult = { ok: true } | { ok: false; error?: string }

export async function clearReminderImageFiles(): Promise<ReminderImageClearResult> {
  try {
    await removeExistingImageFiles()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function reminderImageExists(ext: string): boolean {
  return existsSync(getReminderImagePath(ext))
}

export function getReminderImageUrlFromExt(ext: string | null | undefined): string | null {
  if (!ext) return null
  const normalized = ext.replace(/^\./, '').toLowerCase()
  if (!reminderImageExists(normalized)) return null
  return buildReminderImagePreviewUrl(normalized)
}
