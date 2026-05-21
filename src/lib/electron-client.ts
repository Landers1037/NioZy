import type { ElectronAPI } from '../../electron/shared/api-types'
import {
  installBrowserDevMockIfNeeded,
  isBrowserDevPreview,
} from './electron-browser-mock'

export { isBrowserDevPreview }

export function isElectron(): boolean {
  installBrowserDevMockIfNeeded()
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  return typeof api?.settings?.get === 'function'
}

export function getElectronAPI(): ElectronAPI {
  installBrowserDevMockIfNeeded()
  const api = window.electronAPI
  if (!api?.settings) {
    throw new Error(
      '未检测到 Electron 预加载 API。请使用 npm run start 启动桌面应用，不要直接在浏览器中打开 Vite 地址。',
    )
  }
  return api
}
