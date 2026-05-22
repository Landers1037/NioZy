import { getElectronAPI } from '@/lib/electron-client'

let cachedFonts: string[] | null = null
let loadPromise: Promise<string[]> | null = null

/** 渲染进程侧缓存；主进程已缓存 font-list 结果 */
export function loadSystemFonts(): Promise<string[]> {
  if (cachedFonts) return Promise.resolve(cachedFonts)
  if (!loadPromise) {
    loadPromise = getElectronAPI()
      .fonts.list()
      .then((fonts) => {
        cachedFonts = fonts
        return fonts
      })
      .finally(() => {
        loadPromise = null
      })
  }
  return loadPromise
}
