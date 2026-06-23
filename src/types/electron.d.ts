import type { HTMLAttributes, Ref } from 'preact'
import type { ElectronAPI } from '../../electron/shared/api-types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      webview: HTMLAttributes<HTMLElement> & {
        src?: string
        allowpopups?: string
        partition?: string
        useragent?: string
        disablewebsecurity?: string
        nodeintegration?: string
        webpreferences?: string
        ref?: Ref<HTMLElement & { loadURL: (url: string) => Promise<void> }>
      }
    }
  }
}

export {}
