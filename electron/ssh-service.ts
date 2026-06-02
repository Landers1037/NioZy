import { readdir, stat } from 'fs/promises'
import { homedir, platform } from 'os'
import { join, normalize } from 'path'
import { resolveExecutable } from './resolve-executable'
import { scpLog } from './scp-logger'
import {
  downloadViaSsh2,
  listRemoteViaSsh2,
  uploadViaSsh2,
} from './ssh2-transfer'
import type { ScpProgressCallback } from './ssh2-transfer'
import type {
  ScpCheckResult,
  ScpFileEntry,
  ScpListResult,
  ScpTransferResult,
  SshConnectionProfile,
} from './shared/ssh-types'

const POST_TRANSFER_LIST_DELAY_MS = 800
const LIST_REMOTE_RETRY_DELAY_MS = 1_500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 设置页检测系统是否安装 OpenSSH scp；实际传输走 ssh2/SFTP */
export function checkScpInPath(): ScpCheckResult {
  const path = resolveExecutable('scp')
  return path ? { found: true, path } : { found: false }
}

export async function listFilesystemRoots(): Promise<ScpListResult> {
  try {
    if (platform() === 'win32') {
      const entries: ScpFileEntry[] = []
      for (let code = 65; code <= 90; code++) {
        const letter = String.fromCharCode(code)
        const path = `${letter}:\\`
        try {
          const st = await stat(path)
          if (st.isDirectory()) {
            entries.push({ name: `${letter}:`, path, isDirectory: true })
          }
        } catch {
          /* 盘符不可用 */
        }
      }
      return { ok: true, entries }
    }
    return {
      ok: true,
      entries: [{ name: '/', path: '/', isDirectory: true }],
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function listLocalDirectory(dirPath: string): Promise<ScpListResult> {
  try {
    const resolved = normalize(dirPath || homedir())
    const names = await readdir(resolved)
    const entries: ScpFileEntry[] = []
    for (const name of names) {
      if (name === '.' || name === '..') continue
      const full = join(resolved, name)
      try {
        const st = await stat(full)
        entries.push({
          name,
          path: full,
          isDirectory: st.isDirectory(),
          size: st.isFile() ? st.size : undefined,
        })
      } catch {
        /* 跳过无权限项 */
      }
    }
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return { ok: true, entries }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function listRemoteDirectory(
  profile: SshConnectionProfile,
  remotePath: string,
  enabledKex?: string[],
): Promise<ScpListResult> {
  scpLog('listRemote via ssh2/sftp (in-process password/key auth)')
  return listRemoteViaSsh2(profile, remotePath, enabledKex)
}

export async function listRemoteDirectoryWithRetry(
  profile: SshConnectionProfile,
  remotePath: string,
  options?: { afterTransfer?: boolean },
  enabledKex?: string[],
): Promise<ScpListResult> {
  const maxAttempts = options?.afterTransfer ? 3 : 1
  if (options?.afterTransfer) {
    scpLog('listRemote after transfer: wait before refresh', {
      delayMs: POST_TRANSFER_LIST_DELAY_MS,
    })
    await delay(POST_TRANSFER_LIST_DELAY_MS)
  }

  let last: ScpListResult = { ok: false, error: 'listRemote failed' }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      scpLog('listRemote retry', { attempt, maxAttempts, remotePath })
      await delay(LIST_REMOTE_RETRY_DELAY_MS)
    }
    last = await listRemoteDirectory(profile, remotePath, enabledKex)
    if (last.ok) return last
    const retryable = /timed out|timeout|Connection reset|Connection refused|ECONN/i.test(
      last.error ?? '',
    )
    if (!retryable || attempt === maxAttempts) break
  }
  return last
}

export async function scpUpload(
  profile: SshConnectionProfile,
  localPath: string,
  remotePath: string,
  onProgress?: ScpProgressCallback,
  enabledKex?: string[],
): Promise<ScpTransferResult> {
  return uploadViaSsh2(profile, localPath, remotePath, onProgress, enabledKex)
}

export async function scpDownload(
  profile: SshConnectionProfile,
  remotePath: string,
  localPath: string,
  onProgress?: ScpProgressCallback,
  enabledKex?: string[],
): Promise<ScpTransferResult> {
  return downloadViaSsh2(profile, remotePath, localPath, onProgress, enabledKex)
}
