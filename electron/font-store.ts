import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getFonts } from 'font-list'
import { ensureConfigDir, getFontsCacheFilePath } from './config-paths'
import { runMainWorkerTask } from './workers/main-worker-pool'

interface FontsCacheFile {
  fonts: string[]
  updatedAt: number
}

let memoryCache: string[] | null = null
let loadPromise: Promise<string[]> | null = null

function readDiskCache(): string[] | null {
  const cachePath = getFontsCacheFilePath()
  if (!existsSync(cachePath)) return null
  try {
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8')) as FontsCacheFile
    if (!Array.isArray(raw.fonts) || raw.fonts.length === 0) return null
    return raw.fonts
  } catch {
    return null
  }
}

function writeDiskCache(fonts: string[]): void {
  ensureConfigDir()
  const payload: FontsCacheFile = { fonts, updatedAt: Date.now() }
  writeFileSync(getFontsCacheFilePath(), JSON.stringify(payload, null, 2), 'utf-8')
}

async function fetchFromSystemFallback(): Promise<string[]> {
  const raw = await getFonts({ disableQuoting: true })
  return [...new Set(raw)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

async function fetchFromWorkerOrFallback(): Promise<string[]> {
  try {
    return await runMainWorkerTask<string[]>('fonts:fetchAndNormalize', {})
  } catch {
    return fetchFromSystemFallback()
  }
}

/** 获取系统字体列表；内存与磁盘缓存，避免重复调用 font-list */
export function listSystemFonts(): Promise<string[]> {
  if (memoryCache) return Promise.resolve(memoryCache)
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const disk = readDiskCache()
    if (disk) {
      memoryCache = disk
      return disk
    }

    const fonts = await fetchFromWorkerOrFallback()
    memoryCache = fonts
    writeDiskCache(fonts)
    return fonts
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}
