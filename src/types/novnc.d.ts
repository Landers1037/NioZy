declare module '@novnc/novnc' {
  // noVNC ships plain JS modules without TypeScript declarations.
  // We declare a minimal surface needed by this app.
  export type RfbCredentials = {
    username?: string
    password?: string
    target?: string
  }

  export interface RfbOptions {
    credentials?: RfbCredentials
    shared?: boolean
    repeaterID?: string
    wsProtocols?: string[]
  }

  export interface RfbEvent {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detail?: any
  }

  export default class RFB {
    constructor(target: Element, url: string, options?: RfbOptions)
    disconnect(): void
    scaleViewport: boolean
    resizeSession: boolean
    clipViewport: boolean
    showDotCursor: boolean
    qualityLevel: number
    compressionLevel: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener(type: string, listener: (ev: any) => void): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeEventListener(type: string, listener: (ev: any) => void): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCredentials(credentials: RfbCredentials): void
  }
}

