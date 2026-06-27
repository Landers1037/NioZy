import { mkdir, stat } from 'fs/promises'
import { dirname, posix as pathPosix } from 'path'
import { Client, type FileInfo, type ProgressInfo } from 'basic-ftp'
import type {
  FtpConnectionProfile,
  ScpFileEntry,
  ScpListResult,
  ScpTransferProgress,
  ScpTransferResult,
} from './shared/api-types'

const POST_TRANSFER_LIST_DELAY_MS = 800
const LIST_REMOTE_RETRY_DELAY_MS = 1_500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function joinRemotePath(base: string, name: string): string {
  if (!base || base === '/') return `/${name}`
  return `${base.replace(/\/+$/, '')}/${name}`
}

function normalizeRemoteRequest(requestedPath: string, homePath: string): string {
  const trimmed = requestedPath.trim()
  if (!trimmed || trimmed === '~') return homePath
  if (trimmed.startsWith('~/')) return joinRemotePath(homePath, trimmed.slice(2))
  return trimmed
}

function createClient(profile: FtpConnectionProfile): Client {
  return new Client(profile.timeoutSeconds * 1000)
}

async function connectClient(profile: FtpConnectionProfile): Promise<Client> {
  if (profile.transferMode === 'active') {
    throw new Error('basic-ftp 暂不支持 FTP 主动模式（Active Mode）')
  }

  const client = createClient(profile)
  await client.access({
    host: profile.host,
    port: profile.port,
    user: profile.user,
    password: profile.password,
    secure:
      profile.security === 'implicit'
        ? 'implicit'
        : profile.security === 'explicit',
  })
  return client
}

async function withFtpClient<T>(
  profile: FtpConnectionProfile,
  fn: (client: Client, homePath: string) => Promise<T>,
): Promise<T> {
  const client = await connectClient(profile)
  try {
    const homePath = await client.pwd()
    return await fn(client, homePath || '/')
  } finally {
    client.close()
  }
}

function mapListEntries(entries: FileInfo[], basePath: string): ScpFileEntry[] {
  return entries
    .filter((entry) => entry.name !== '.' && entry.name !== '..')
    .map((entry) => ({
      name: entry.name,
      path: joinRemotePath(basePath, entry.name),
      isDirectory: entry.isDirectory,
      size: entry.isDirectory ? undefined : entry.size,
    }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

function mapProgress(
  progress: ProgressInfo,
  direction: 'upload' | 'download',
  fileName: string,
  total: number,
): ScpTransferProgress {
  return {
    direction,
    fileName,
    transferred: Math.min(progress.bytes, total || progress.bytes),
    total,
  }
}

export async function listRemoteDirectory(
  profile: FtpConnectionProfile,
  remotePath: string,
): Promise<ScpListResult> {
  try {
    return await withFtpClient(profile, async (client, homePath) => {
      const targetPath = normalizeRemoteRequest(remotePath, homePath)
      const entries = await client.list(targetPath)
      return {
        ok: true,
        entries: mapListEntries(entries, targetPath),
        resolvedPath: targetPath,
      }
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function listRemoteDirectoryWithRetry(
  profile: FtpConnectionProfile,
  remotePath: string,
  options?: { afterTransfer?: boolean },
): Promise<ScpListResult> {
  const maxAttempts = options?.afterTransfer ? 3 : 1
  if (options?.afterTransfer) await delay(POST_TRANSFER_LIST_DELAY_MS)

  let last: ScpListResult = { ok: false, error: 'listRemote failed' }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await delay(LIST_REMOTE_RETRY_DELAY_MS)
    last = await listRemoteDirectory(profile, remotePath)
    if (last.ok) return last
    const retryable = /timed out|timeout|Connection reset|Connection refused|ECONN/i.test(
      last.error ?? '',
    )
    if (!retryable || attempt === maxAttempts) break
  }
  return last
}

export async function upload(
  profile: FtpConnectionProfile,
  localPath: string,
  remotePath: string,
  onProgress?: (progress: ScpTransferProgress) => void,
): Promise<ScpTransferResult> {
  try {
    const fileStat = await stat(localPath)
    const total = fileStat.size
    const fileName = pathPosix.basename(remotePath)

    await withFtpClient(profile, async (client) => {
      client.trackProgress((info) => {
        if (info.type !== 'upload') return
        onProgress?.(mapProgress(info, 'upload', fileName, total))
      })
      await client.uploadFrom(localPath, remotePath)
      client.trackProgress(() => undefined)
    })

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function download(
  profile: FtpConnectionProfile,
  remotePath: string,
  localPath: string,
  onProgress?: (progress: ScpTransferProgress) => void,
): Promise<ScpTransferResult> {
  try {
    const fileName = pathPosix.basename(remotePath)

    await withFtpClient(profile, async (client) => {
      const total = await client.size(remotePath).catch(() => 0)
      await mkdir(dirname(localPath), { recursive: true })
      client.trackProgress((info) => {
        if (info.type !== 'download') return
        onProgress?.(mapProgress(info, 'download', fileName, total))
      })
      await client.downloadTo(localPath, remotePath)
      client.trackProgress(() => undefined)
    })

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function downloadDirectory(
  profile: FtpConnectionProfile,
  remotePath: string,
  localPath: string,
  onProgress?: (progress: ScpTransferProgress) => void,
): Promise<ScpTransferResult> {
  try {
    await withFtpClient(profile, async (client) => {
      await mkdir(localPath, { recursive: true })
      client.trackProgress((info) => {
        if (info.type !== 'download') return
        onProgress?.({
          direction: 'download',
          fileName: info.name || pathPosix.basename(remotePath),
          transferred: info.bytesOverall,
          total: 0,
        })
      })
      await client.downloadToDir(localPath, remotePath)
      client.trackProgress(() => undefined)
    })
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function parentRemotePath(currentPath: string): string {
  if (!currentPath || currentPath === '/' || currentPath === '~') return currentPath || '/'
  const parent = pathPosix.dirname(currentPath.replace(/\/+$/, ''))
  return parent === '.' ? '/' : parent
}
