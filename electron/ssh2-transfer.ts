import { Client, type ConnectConfig, type SFTPWrapper } from 'ssh2'
import { existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import { logScpError, logScpProfile, scpLog } from './scp-logger'
import type {
  ScpFileEntry,
  ScpListResult,
  ScpTransferProgress,
  ScpTransferResult,
  SshConnectionProfile,
} from './shared/ssh-types'

export type ScpProgressCallback = (progress: ScpTransferProgress) => void

const CONNECT_TIMEOUT_MS = 20_000

async function buildConnectConfig(profile: SshConnectionProfile): Promise<ConnectConfig> {
  const config: ConnectConfig = {
    host: profile.host,
    port: profile.port ?? 22,
    username: profile.user,
    readyTimeout: CONNECT_TIMEOUT_MS,
    tryKeyboard: Boolean(profile.password),
  }

  if (profile.password) {
    config.password = profile.password
  }

  const keyPath = profile.keyPath?.trim()
  if (keyPath) {
    if (!existsSync(keyPath)) {
      throw new Error(`私钥文件不存在: ${keyPath}`)
    }
    config.privateKey = await readFile(keyPath, 'utf8')
  }

  if (!config.password && !config.privateKey) {
    throw new Error('未配置 SSH 密码或私钥')
  }

  return config
}

function withSftp<T>(profile: SshConnectionProfile, fn: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const password = profile.password

    conn.on('keyboard-interactive', (_name, _instr, _lang, prompts, finish) => {
      if (password && prompts.length > 0) {
        finish(prompts.map(() => password))
      } else {
        finish([])
      }
    })

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

    void buildConnectConfig(profile)
      .then((config) => {
        scpLog('ssh2 connect', {
          host: config.host,
          port: config.port,
          user: config.username,
          hasPassword: Boolean(password),
          hasKey: Boolean(config.privateKey),
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
): Promise<ScpListResult> {
  logScpProfile('listRemote (ssh2/sftp)', profile)
  const path = remotePath?.trim() || '~'

  try {
    return await withSftp(profile, async (sftp) => {
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
    await withSftp(profile, async (sftp) => {
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
): Promise<ScpTransferResult> {
  logScpProfile('download (ssh2/sftp)', profile)
  const fileName = basename(remotePath)
  const emit = (transferred: number, total: number) => {
    onProgress?.({ direction: 'download', fileName, transferred, total })
  }
  emit(0, 0)
  try {
    await withSftp(profile, async (sftp) => {
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
