declare module 'basic-ftp' {
  import type { Readable, Writable } from 'node:stream'

  export interface AccessOptions {
    host?: string
    port?: number
    user?: string
    password?: string
    secure?: boolean | 'implicit'
  }

  export interface FileInfo {
    name: string
    size: number
    isDirectory: boolean
  }

  export interface ProgressInfo {
    name: string
    type: 'upload' | 'download' | string
    bytes: number
    bytesOverall: number
  }

  export class Client {
    constructor(timeout?: number)
    access(options: AccessOptions): Promise<void>
    close(): void
    pwd(): Promise<string>
    list(path?: string): Promise<FileInfo[]>
    size(path: string): Promise<number>
    ensureDir(remoteDirPath: string): Promise<void>
    cd(path: string): Promise<void>
    uploadFrom(source: string | Readable, toRemotePath: string): Promise<void>
    downloadTo(destination: string | Writable, fromRemotePath: string, startAt?: number): Promise<void>
    downloadToDir(localDirPath: string, remoteDirPath?: string): Promise<void>
    trackProgress(handler: (info: ProgressInfo) => void): void
  }
}
