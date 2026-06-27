import { Telnet } from 'telnet-client'

const host = process.argv[2]
const port = Number(process.argv[3] ?? '23') || 23

if (!host) {
  process.stderr.write('Missing telnet host.\r\n')
  process.exit(1)
}

const client = new Telnet()
let sawOutput = false
let shuttingDown = false

function shutdown(code = 0, message) {
  if (shuttingDown) return
  shuttingDown = true
  if (message) {
    process.stderr.write(`${message}\r\n`)
  }
  try {
    client.end()
  } catch {
    // ignore
  }
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false)
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 80)
}

try {
  await client.connect({
    host,
    port,
    timeout: 10_000,
    shellPrompt: '',
    negotiationMandatory: false,
  })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`)
  process.exit(1)
}

const socket = client.socket
if (!socket) {
  process.stderr.write('Telnet socket not available.\r\n')
  process.exit(1)
}

process.stdout.write(`Connected to ${host}:${port}.\r\n`)

client.on('data', (chunk) => {
  sawOutput = true
  process.stdout.write(chunk)
})

socket.on('close', () =>
  shutdown(
    0,
    sawOutput ? 'Connection closed.' : 'Connection closed before any data was received.',
  ),
)
socket.on('end', () =>
  shutdown(
    0,
    sawOutput ? 'Connection ended.' : 'Connection ended before any data was received.',
  ),
)
socket.on('error', (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`)
  shutdown(1)
})

process.stdin.resume()
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
}
process.stdin.on('data', (chunk) => {
  socket.write(chunk)
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
