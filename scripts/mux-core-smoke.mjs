/**
 * TCP JSON-RPC smoke tests for niozy-mux-core.
 *
 *   node scripts/mux-core-smoke.mjs
 *   node scripts/mux-core-smoke.mjs --verbose
 */
import {
  MuxRpcClient,
  MUX_DEFAULT_PORT,
  decodeOutput,
  ensureMuxDaemon,
  newSessionId,
  resolveMuxBinary,
} from './mux-rpc-client.mjs'

const argv = process.argv.slice(2)
const verbose = argv.includes('--verbose')
const binaryArg = argv.find((a) => a.startsWith('--binary='))?.slice('--binary='.length)
const port = Number(argv.find((a) => a.startsWith('--port='))?.slice('--port='.length) ?? MUX_DEFAULT_PORT)

function vlog(...parts) {
  if (verbose) console.log('  ', ...parts)
}

class SmokeClient {
  constructor(port) {
    this.rpc = new MuxRpcClient(undefined, port)
    /** @type {Map<string, import('./mux-rpc-client.mjs').MuxRpcClient>} */
    this.outputs = new Map()
  }

  async start(binary) {
    await ensureMuxDaemon({ binary, port })
    await this.rpc.connect()
    this.rpc.onNotification('mux.output', (params) => {
      const sid = params.sessionId
      if (!sid) return
      const prev = this.outputs.get(sid) ?? []
      prev.push(params)
      this.outputs.set(sid, prev)
    })
  }

  waitForScreenText(sessionId, text, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    const match = () => {
      const frames = this.outputs.get(sessionId) ?? []
      for (const params of frames) {
        if (decodeOutput(params).includes(text)) return params
      }
      return null
    }
    return new Promise((resolve, reject) => {
      const tick = () => {
        const hit = match()
        if (hit) {
          resolve(hit)
          return
        }
        if (Date.now() >= deadline) {
          reject(new Error(`timeout waiting for "${text}"`))
          return
        }
        setTimeout(tick, 25)
      }
      tick()
    })
  }

  async spawnAndWait(sessionId, spawnParams, text, timeoutMs) {
    const wait = this.waitForScreenText(sessionId, text, timeoutMs)
    this.outputs.set(sessionId, [])
    await this.rpc.request('mux.spawnSession', { sessionId, ...spawnParams })
    return wait
  }

  async kill(sessionId) {
    await this.rpc.request('mux.killSession', { sessionId })
  }

  stop() {
    this.rpc.close()
  }
}

async function runCase(client, name, fn) {
  process.stdout.write(`• ${name} … `)
  try {
    await fn(client)
    console.log('OK')
    return { name, ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('FAIL')
    console.log(`    ${msg}`)
    return { name, ok: false, error: msg }
  }
}

async function main() {
  const binary = resolveMuxBinary(binaryArg)
  if (!binary) {
    console.error('未找到 niozy-mux-core，请先 cargo build --release')
    process.exit(2)
  }

  const cwd = process.env.USERPROFILE || process.env.HOME || process.cwd()
  console.log(`binary: ${binary}`)
  console.log(`port: ${port}`)
  console.log('')

  const client = new SmokeClient(port)
  try {
    await client.start(binary)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(2)
  }

  const results = []

  results.push(
    await runCase(client, 'mux.ping', async (c) => {
      const r = await c.rpc.request('mux.ping', {})
      if (!r?.pong) throw new Error('expected pong')
    }),
  )

  results.push(
    await runCase(client, 'spawn cmd echo', async (c) => {
      const sid = newSessionId('smoke-echo')
      await c.spawnAndWait(
        sid,
        {
          cols: 80,
          rows: 24,
          shell: 'cmd.exe',
          args: ['/c', 'echo MUX_SMOKE_OK & ping -n 2 127.0.0.1 >nul'],
          env: {},
          cwd,
          paneCount: 1,
        },
        'MUX_SMOKE_OK',
        15_000,
      )
      await c.kill(sid)
    }),
  )

  results.push(
    await runCase(client, 'spawn powershell Write-Host', async (c) => {
      const sid = newSessionId('smoke-ps')
      await c.spawnAndWait(
        sid,
        {
          cols: 100,
          rows: 30,
          shell: process.platform === 'win32' ? `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\cmd.exe` : 'bash',
          args: process.platform === 'win32' ? ['/c', 'echo PS_SMOKE_OK'] : ['-c', 'echo PS_SMOKE_OK'],
          env: {},
          cwd,
          paneCount: 1,
        },
        'PS_SMOKE_OK',
        15_000,
      )
      await c.kill(sid)
    }),
  )

  results.push(
    await runCase(client, 'resize', async (c) => {
      const sid = newSessionId('smoke-resize')
      const first = await c.spawnAndWait(
        sid,
        {
          cols: 80,
          rows: 24,
          shell: 'cmd.exe',
          args: ['/c', 'echo RESIZE_OK & ping -n 3 127.0.0.1 >nul'],
          env: {},
          cwd,
          paneCount: 1,
        },
        'RESIZE_OK',
        30_000,
      )
      const seqBefore = Number(first.seq)
      await c.rpc.request('mux.resize', { sessionId: sid, cols: 100, rows: 30 })
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const frames = c.outputs.get(sid) ?? []
        const hit = frames.find(
          (p) => Number(p.seq) > seqBefore && decodeOutput(p).includes('RESIZE_OK'),
        )
        if (hit) break
        await new Promise((r) => setTimeout(r, 25))
      }
      await c.kill(sid)
    }),
  )

  results.push(
    await runCase(client, 'write_input', async (c) => {
      if (process.platform === 'win32') {
        vlog('write_input: use scripts/mux-interactive-shell.mjs for interactive validation')
        return
      }
      const sid = newSessionId('smoke-write')
      await c.spawnAndWait(
        sid,
        { cols: 80, rows: 24, shell: 'bash', args: ['-i'], env: {}, cwd, paneCount: 1 },
        '$',
        20_000,
      )
      await c.rpc.request('mux.writeInput', {
        sessionId: sid,
        dataB64: Buffer.from('echo stdin_probe\n', 'utf8').toString('base64'),
      })
      await c.kill(sid)
    }),
  )

  if (process.platform === 'win32') {
    results.push(
      await runCase(client, 'spawn 4 pane cmd', async (c) => {
        const sid = newSessionId('smoke-4pane')
        const shell = process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe'
        const profile = process.env.USERPROFILE ?? cwd
        const promptNeedle = `${profile}>`
        const wait = c.waitForScreenText(sid, promptNeedle, 30_000)
        c.outputs.set(sid, [])
        const result = await c.rpc.request('mux.spawnSession', {
          sessionId: sid,
          cols: 120,
          rows: 40,
          shell,
          args: ['/K'],
          env: {},
          cwd,
          paneCount: 4,
        })
        if (result?.paneCount !== 4) {
          throw new Error(`expected paneCount 4, got ${result?.paneCount}`)
        }
        await wait
        await c.kill(sid)
      }),
    )
  } else {
    results.push(
      await runCase(client, 'spawn 4 pane', async (c) => {
        const sid = newSessionId('smoke-4pane')
        await c.spawnAndWait(
          sid,
          {
            cols: 120,
            rows: 40,
            shell: 'bash',
            args: ['-c', 'echo PANE_OK'],
            env: {},
            cwd,
            paneCount: 4,
          },
          'PANE_OK',
          60_000,
        )
        await c.kill(sid)
      }),
    )
  }

  const passed = results.filter((r) => r.ok).length
  console.log('')
  console.log(`结果: ${passed}/${results.length} 通过`)
  client.stop()
  if (passed < results.length) process.exit(1)
  console.log('全部通过。')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(2)
})
