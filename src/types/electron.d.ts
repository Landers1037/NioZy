import type { ElectronAPI } from '../../electron/shared/api-types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          allowpopups?: string
          partition?: string
          useragent?: string
          disablewebsecurity?: string
          nodeintegration?: string
          webpreferences?: string
          ref?: React.Ref<HTMLElement & { loadURL: (url: string) => Promise<void> }>
        },
        HTMLElement
      >
    }
  }
}

export {}
