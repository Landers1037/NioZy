import { spawn } from 'child_process'
import { readdir, stat } from 'fs/promises'
import { homedir, platform } from 'os'
import { join, normalize } from 'path'
import { resolveExecutable } from './resolve-executable'
import type {
  ScpCheckResult,
  ScpFileEntry,
  ScpListResult,
  ScpTransferResult,
  SshConnectionProfile,
} from './shared/ssh-types'

function quoteRemotePath(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`
}

function buildSshBaseArgs(profile: SshConnectionProfile): string[] {
  const args: string[] = []
  if (profile.port !== 22) args.push('-p', String(profile.port))
  if (profile.keyPath?.trim()) args.push('-i', profile.keyPath.trim())
  args.push('-o', 'BatchMode=yes')
  args.push('-o', 'ConnectTimeout=15')
  args.push('-o', 'StrictHostKeyChecking=accept-new')
  return args
}

function runProcess(
  file: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code }))
  })
}

export function checkScpInPath(): ScpCheckResult {
  const path = resolveExecutable('scp')
  return path ? { found: true, path } : { found: false }
}

/** 文件系统树根节点：Windows 为盘符，其它平台为 / */
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

function parseRemoteLsOutput(stdout: string, basePath: string): ScpFileEntry[] {
  const entries: ScpFileEntry[] = []
  const lines = stdout.split(/\r?\n/).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('total ')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue
    const permissions = parts[0] ?? ''
    const name = parts.slice(8).join(' ')
    if (!name || name === '.' || name === '..') continue
    const isDirectory = permissions.startsWith('d')
    const size = parseInt(parts[4] ?? '0', 10)
    const remotePath =
      basePath === '/' || basePath === ''
        ? `/${name}`
        : `${basePath.replace(/\/$/, '')}/${name}`
    entries.push({
      name,
      path: remotePath,
      isDirectory,
      size: Number.isFinite(size) ? size : undefined,
    })
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return entries
}

export async function listRemoteDirectory(
  profile: SshConnectionProfile,
  remotePath: string,
): Promise<ScpListResult> {
  const ssh = resolveExecutable('ssh')
  if (!ssh) {
    return { ok: false, error: '未找到 ssh 命令。请安装 OpenSSH 客户端或 Git for Windows。' }
  }

  const path = remotePath?.trim() || '~'
  const quoted = quoteRemotePath(path)
  const args = [
    ...buildSshBaseArgs(profile),
    `${profile.user}@${profile.host}`,
    `ls -la -- ${quoted} 2>/dev/null || ls -la ${quoted}`,
  ]

  try {
    const { stdout, stderr, code } = await runProcess(ssh, args)
    if (code !== 0) {
      return { ok: false, error: stderr.trim() || `ssh 退出码 ${code}` }
    }
    const base =
      path === '~' ? `/home/${profile.user}` : path.startsWith('/') ? path : `/${path}`
    return { ok: true, entries: parseRemoteLsOutput(stdout, base) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function buildScpArgs(profile: SshConnectionProfile, scpArgs: string[]): string[] {
  const args: string[] = []
  if (profile.port !== 22) args.push('-P', String(profile.port))
  if (profile.keyPath?.trim()) args.push('-i', profile.keyPath.trim())
  args.push('-o', 'BatchMode=yes')
  args.push('-o', 'ConnectTimeout=60')
  args.push(...scpArgs)
  return args
}

export async function scpUpload(
  profile: SshConnectionProfile,
  localPath: string,
  remotePath: string,
): Promise<ScpTransferResult> {
  const scp = resolveExecutable('scp')
  if (!scp) return { ok: false, error: '未找到 scp.exe，请确认 PATH 中已安装 OpenSSH 客户端。' }

  const target = `${profile.user}@${profile.host}:${remotePath}`
  const args = buildScpArgs(profile, [localPath, target])
  try {
    const { stderr, code } = await runProcess(scp, args)
    if (code !== 0) return { ok: false, error: stderr.trim() || `scp 退出码 ${code}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function scpDownload(
  profile: SshConnectionProfile,
  remotePath: string,
  localPath: string,
): Promise<ScpTransferResult> {
  const scp = resolveExecutable('scp')
  if (!scp) return { ok: false, error: '未找到 scp.exe，请确认 PATH 中已安装 OpenSSH 客户端。' }

  const source = `${profile.user}@${profile.host}:${remotePath}`
  const args = buildScpArgs(profile, [source, localPath])
  try {
    const { stderr, code } = await runProcess(scp, args)
    if (code !== 0) return { ok: false, error: stderr.trim() || `scp 退出码 ${code}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
