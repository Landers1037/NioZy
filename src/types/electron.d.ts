import type { ElectronAPI } from '../../electron/shared/api-types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
