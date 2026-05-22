import type { ElectronAPI } from '../../electron/shared/api-types'
import i18n from '@/lib/i18n'
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
    throw new Error(i18n.t('electron.preloadMissing'))
  }
  return api
}
