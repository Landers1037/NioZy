import { Client, type SFTPWrapper } from 'ssh2'
import { stat } from 'fs/promises'
import { basename, join } from 'path'
import { attachSsh2KeyboardInteractive, buildSsh2ConnectConfig } from './ssh2-connect'
import { logScpError, logScpProfile, scpLog } from './scp-logger'
import type {
  ScpFileEntry,
  ScpListResult,
  ScpTransferProgress,
  ScpTransferResult,
  SshConnectionProfile,
} from './shared/ssh-types'

export type ScpProgressCallback = (progress: ScpTransferProgress) => void

function withSftp<T>(
  profile: SshConnectionProfile,
  enabledKex: string[] | undefined,
  connectTimeoutSeconds: number | undefined,
  fn: (sftp: SFTPWrapper) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const password = profile.password

    attachSsh2KeyboardInteractive(conn, password)

    conn.on('ready', () => {
      scpLog('ssh2 connected', { host: profile.host, user: profile.user })
      conn.sftp(async (err, sftp) => {
        if (err) {
          conn.end()
          reject(err)
          return
        }
        try {
          const result = await fn(sftp)
          conn.end()
          resolve(result)
        } catch (e) {
          conn.end()
          reject(e)
        }
      })
    })

    conn.on('error', (err) => {
      logScpError('ssh2 connection error', err)
      reject(err)
    })

    void buildSsh2ConnectConfig(profile, enabledKex, connectTimeoutSeconds)
      .then((config) => {
        scpLog('ssh2 connect', {
          host: config.host,
          port: config.port,
          user: config.username,
          hasPassword: Boolean(password),
          hasKey: Boolean(config.privateKey),
          kexCount: Array.isArray(config.algorithms?.kex) ? config.algorithms.kex.length : undefined,
        })
        conn.connect(config)
      })
      .catch(reject)
  })
}

function normalizeRemoteDir(remotePath: string): string {
  const p = remotePath?.trim() || '.'
  return p === '~' ? '.' : p
}

function entriesFromReaddir(list: SftpDirEntry[], basePath: string): ScpFileEntry[] {
  const base = basePath.replace(/\/$/, '') || '/'
  const entries: ScpFileEntry[] = []
  for (const item of list) {
    if (item.filename === '.' || item.filename === '..') continue
    const full =
      base === '/' ? `/${item.filename}` : `${base}/${item.filename}`
    entries.push({
      name: item.filename,
      path: full,
      isDirectory: item.attrs.isDirectory(),
      size: item.attrs.isFile() ? item.attrs.size : undefined,
    })
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return entries
}

type SftpDirEntry = {
  filename: string
  attrs: { isDirectory: () => boolean; isFile: () => boolean; size: number }
}

function readdirAsync(sftp: SFTPWrapper, path: string): Promise<SftpDirEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) reject(err)
      else resolve(list as SftpDirEntry[])
    })
  })
}

function realpathAsync(sftp: SFTPWrapper, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(path, (err, abs) => {
      if (err) reject(err)
      else resolve(abs)
    })
  })
}

function fastPutAsync(
  sftp: SFTPWrapper,
  local: string,
  remote: string,
  onStep?: (transferred: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err: Error | null | undefined) => {
      if (err) reject(err)
      else resolve()
    }
    if (onStep) {
      sftp.fastPut(local, remote, {
        step: (transferred, _chunk, total) => onStep(transferred, total),
      }, done)
    } else {
      sftp.fastPut(local, remote, done)
    }
  })
}

function fastGetAsync(
  sftp: SFTPWrapper,
  remote: string,
  local: string,
  onStep?: (transferred: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (err: Error | null | undefined) => {
      if (err) reject(err)
      else resolve()
    }
    if (onStep) {
      sftp.fastGet(remote, local, {
        step: (transferred, _chunk, total) => onStep(transferred, total),
      }, done)
    } else {
      sftp.fastGet(remote, local, done)
    }
  })
}

export async function listRemoteViaSsh2(
  profile: SshConnectionProfile,
  remotePath: string,
  enabledKex?: string[],
  connectTimeoutSeconds?: number,
): Promise<ScpListResult> {
  logScpProfile('listRemote (ssh2/sftp)', profile)
  const path = remotePath?.trim() || '~'

  try {
    return await withSftp(profile, enabledKex, connectTimeoutSeconds, async (sftp) => {
      const dir = normalizeRemoteDir(path)
      let resolvedPath: string
      try {
        resolvedPath = await realpathAsync(sftp, dir)
      } catch {
        resolvedPath = dir.startsWith('/') ? dir : join('/', dir)
      }
      const list = await readdirAsync(sftp, dir)
      const entries = entriesFromReaddir(list, resolvedPath)
      scpLog('listRemote (ssh2) ok', { entryCount: entries.length, resolvedPath })
      return { ok: true, entries, resolvedPath }
    })
  } catch (err) {
    logScpError('listRemote (ssh2)', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function uploadViaSsh2(
  profile: SshConnectionProfile,
  localPath: string,
  remotePath: string,
  onProgress?: ScpProgressCallback,
  enabledKex?: string[],
  connectTimeoutSeconds?: number,
): Promise<ScpTransferResult> {
  logScpProfile('upload (ssh2/sftp)', profile)
  const fileName = basename(localPath)
  let total = 0
  try {
    total = (await stat(localPath)).size
  } catch {
    /* 进度可能未知 */
  }
  const emit = (transferred: number, stepTotal?: number) => {
    onProgress?.({
      direction: 'upload',
      fileName,
      transferred,
      total: stepTotal && stepTotal > 0 ? stepTotal : total,
    })
  }
  emit(0, total)
  try {
    await withSftp(profile, enabledKex, connectTimeoutSeconds, async (sftp) => {
      await fastPutAsync(sftp, localPath, remotePath, (transferred, stepTotal) => {
        emit(transferred, stepTotal)
      })
    })
    scpLog('upload (ssh2) ok', { localPath, remotePath })
    return { ok: true }
  } catch (err) {
    logScpError('upload (ssh2)', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function downloadViaSsh2(
  profile: SshConnectionProfile,
  remotePath: string,
  localPath: string,
  onProgress?: ScpProgressCallback,
  enabledKex?: string[],
  connectTimeoutSeconds?: number,
): Promise<ScpTransferResult> {
  logScpProfile('download (ssh2/sftp)', profile)
  const fileName = basename(remotePath)
  const emit = (transferred: number, total: number) => {
    onProgress?.({ direction: 'download', fileName, transferred, total })
  }
  emit(0, 0)
  try {
    await withSftp(profile, enabledKex, connectTimeoutSeconds, async (sftp) => {
      await fastGetAsync(sftp, remotePath, localPath, (transferred, stepTotal) => {
        emit(transferred, stepTotal)
      })
    })
    scpLog('download (ssh2) ok', { remotePath, localPath })
    return { ok: true }
  } catch (err) {
    logScpError('download (ssh2)', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
