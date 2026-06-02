import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { CustomConnection } from './shared/api-types'

export type RdpConnectResult = { ok: true } | { ok: false; error: string }

function mstscExecutable(): string {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  return join(systemRoot, 'System32', 'mstsc.exe')
}

function runCmdkey(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('cmdkey.exe', args, { windowsHide: true })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`cmdkey exited with code ${code ?? 'unknown'}`))
    })
  })
}

/** 使用 Windows 凭据管理器 + mstsc 启动远程桌面（不经过 PTY） */
export async function launchRdpFromConnection(
  conn: CustomConnection,
  resolveText: (text: string) => string,
): Promise<RdpConnectResult> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'RDP is only supported on Windows' }
  }
  if (conn.type !== 'rdp') {
    return { ok: false, error: 'Not an RDP connection' }
  }

  const host = resolveText((conn.rdpHost ?? conn.command).trim())
  const user = resolveText((conn.rdpUser ?? '').trim())
  const password = conn.rdpPassword?.trim() ? resolveText(conn.rdpPassword.trim()) : ''
  const port = conn.rdpPort ?? 3389

  if (!host) return { ok: false, error: 'Host is required' }
  if (!user) return { ok: false, error: 'Username is required' }

  const mstscPath = mstscExecutable()
  if (!existsSync(mstscPath)) {
    return { ok: false, error: 'mstsc.exe not found' }
  }

  const credentialTarget = port === 3389 ? `TERMSRV/${host}` : `TERMSRV/${host}:${port}`
  const mstscTarget = port === 3389 ? host : `${host}:${port}`

  try {
    if (password) {
      await runCmdkey(['/generic:', credentialTarget, `/user:${user}`, `/pass:${password}`])
    }

    const child = spawn(mstscPath, [`/v:${mstscTarget}`], {
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
