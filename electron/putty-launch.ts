import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { CustomConnection } from './shared/api-types'
import type { ExternalLaunchResult } from './shared/api-types'
import { resolveExecutable } from './resolve-executable'

function resolvePuttyExecutable(): string | null {
  const fromPath = resolveExecutable('putty', process.env)
  if (fromPath) return fromPath

  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 =
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const candidates = [
    join(programFiles, 'PuTTY', 'putty.exe'),
    join(programFilesX86, 'PuTTY', 'putty.exe'),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}

/** 启动 PuTTY 图形客户端（不经过 PTY） */
export async function launchPuttyFromConnection(
  conn: CustomConnection,
  resolveText: (text: string) => string,
): Promise<ExternalLaunchResult> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'PuTTY is only supported on Windows' }
  }
  if (conn.type !== 'putty') {
    return { ok: false, error: 'Not a PuTTY connection' }
  }

  const host = resolveText((conn.puttyHost ?? conn.command).trim())
  if (!host) return { ok: false, error: 'Host is required' }

  const protocol = conn.puttyProtocol ?? 'ssh'
  const defaultPort = protocol === 'telnet' ? 23 : 22
  const port = conn.puttyPort ?? defaultPort
  const user = conn.puttyUser?.trim() ? resolveText(conn.puttyUser.trim()) : ''
  const password = conn.puttyPassword?.trim() ? resolveText(conn.puttyPassword.trim()) : ''

  const puttyPath = resolvePuttyExecutable()
  if (!puttyPath) {
    return { ok: false, error: 'putty.exe not found (install PuTTY or add to PATH)' }
  }

  const args: string[] =
    protocol === 'telnet' ? ['-telnet', host] : ['-ssh', host, ...(user ? ['-l', user] : [])]

  if (port !== defaultPort) args.push('-P', String(port))
  if (password) args.push('-pw', password)

  try {
    const child = spawn(puttyPath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}
