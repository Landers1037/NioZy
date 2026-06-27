declare module 'telnet-client' {
  import { EventEmitter } from 'node:events'

  export interface TelnetConnectOptions {
    host: string
    port?: number
    timeout?: number
    shellPrompt?: string | RegExp
    negotiationMandatory?: boolean
    ors?: string
    irs?: string
    echoLines?: number
  }

  export class Telnet extends EventEmitter {
    connect(options: TelnetConnectOptions): Promise<void>
    end(): void
    destroy(): void
    socket?: NodeJS.WritableStream & NodeJS.ReadableStream
  }
}
