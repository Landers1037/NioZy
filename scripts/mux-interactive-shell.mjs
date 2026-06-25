/**
 * Interactive shell via mux core TCP JSON-RPC.
 *
 * Usage:
 *   node scripts/mux-interactive-shell.mjs
 *   node scripts/mux-interactive-shell.mjs --shell cmd
 *   node scripts/mux-interactive-shell.mjs --shell pwsh
 *
 * Mux 暂不加载 shell-integration.ps1 / Oh My Posh。
 */
import { join } from 'path'
import {
  MuxRpcClient,
  MUX_DEFAULT_PORT,
  decodeOutput,
  ensureMuxDaemon,
  newSessionId,
  resolveMuxBinary,
} from './mux-rpc-client.mjs'

const argv = process.argv.slice(2)

function argValue(flag) {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

const port = Number(argValue('--port') ?? MUX_DEFAULT_PORT)
const shellArg = argValue('--shell')
const cwd = argValue('--cwd') ?? process.env.USERPROFILE ?? process.env.HOME ?? process.cwd()
const binaryArg = argValue('--binary')

function systemRoot() {
  return process.env.SystemRoot ?? 'C:\\Windows'
}

function resolveShell() {
  if (shellArg === 'cmd') return join(systemRoot(), 'System32', 'cmd.exe')
  if (shellArg === 'pwsh') {
    return join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe')
  }
  if (shellArg === 'powershell') {
    return join(systemRoot(), 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  }
  if (shellArg) return shellArg

  if (process.platform === 'win32') {
    return join(systemRoot(), 'System32', 'cmd.exe')
  }
  return process.env.SHELL ?? '/bin/bash'
}

function resolveSpawnArgs(shell) {
  if (process.platform !== 'win32') {
    return ['-i']
  }

  const base = shell.toLowerCase()
  if (base.endsWith('cmd.exe')) {
    return ['/K']
  }
  if (/pwsh|powershell/.test(base)) {
    return ['-NoLogo', '-NoExit']
  }
  return []
}

async function main() {
  const binary = resolveMuxBinary(binaryArg)
  if (!binary) {
    console.error('niozy-mux-core not found. Run: cd niozy-mux-core && cargo build --release')
    process.exit(2)
  }

  await ensureMuxDaemon({ binary, port, killStale: true })

  const client = new MuxRpcClient(undefined, port)
  await client.connect()

  const sessionId = newSessionId('shell')
  const cols = process.stdout.columns || 120
  const rows = process.stdout.rows || 40
  const shell = resolveShell()
  const args = resolveSpawnArgs(shell)

  console.error(`Spawning ${shell} (${cols}x${rows}) …`)

  client.onNotification('mux.output', (params) => {
    if (params.sessionId !== sessionId) return
    process.stdout.write(decodeOutput(params))
  })

  await client.request('mux.spawnSession', {
    sessionId,
    cols,
    rows,
    shell,
    args,
    env: {},
    cwd,
    paneCount: 1,
  })

  console.error('Session ready. Ctrl+C to exit.\n')

  const wasRaw = process.stdin.isTTY && process.stdin.isRaw
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  process.stdin.on('data', (buf) => {
    const data = buf.toString('utf8')
    if (data === '\u0003') {
      cleanup(0)
      return
    }
    client
      .request('mux.writeInput', {
        sessionId,
        dataB64: Buffer.from(data, 'utf8').toString('base64'),
      })
      .catch(() => {})
  })

  async function cleanup(code) {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(!!wasRaw)
    }
    try {
      await client.request('mux.killSession', { sessionId })
    } catch {
      // ignore
    }
    client.close()
    process.exit(code)
  }

  process.on('SIGINT', () => cleanup(0))
  process.on('exit', () => client.close())

  await new Promise(() => {})
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
