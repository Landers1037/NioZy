#!/usr/bin/env node
/**
 * NioZy built-in system info — fastfetch-style logo, system stats, and 256-color palette.
 * Usage: niozy-fetch [options]
 */

import { execSync } from 'node:child_process'
import os from 'node:os'

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

/** NioZy brand blues (256-color) */
const ACCENT = [39, 33, 27, 21, 33, 39]
const LABEL_COLOR = '\x1b[38;5;117m'
const SEP_COLOR = '\x1b[38;5;240m'
const VALUE_COLOR = '\x1b[0m'

const LOGO = [
  '███╗   ██╗██╗ ██████╗ ███████╗██╗   ██╗',
  '████╗  ██║██║██╔═══██╗╚══███╔╝╚██╗ ██╔╝',
  '██╔██╗ ██║██║██║   ██║  ███╔╝  ╚████╔╝ ',
  '██║╚██╗██║██║██║   ██║ ███╔╝    ╚██╔╝  ',
  '██║ ╚████║██║╚██████╔╝███████╗   ██║   ',
  '╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ',
]

const LOGO_WIDTH = Math.max(...LOGO.map((line) => stripAnsi(line).length))

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

function colorizeLogo() {
  return LOGO.map((line, index) => {
    const code = ACCENT[index % ACCENT.length]
    return `\x1b[38;5;${code}m${line}${RESET}`
  })
}

function formatBytes(bytes) {
  const gib = bytes / 1024 ** 3
  if (gib >= 10) return `${gib.toFixed(0)} GiB`
  if (gib >= 1) return `${gib.toFixed(1)} GiB`
  const mib = bytes / 1024 ** 2
  return `${mib.toFixed(0)} MiB`
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min${minutes === 1 ? '' : 's'}`)
  return parts.join(', ')
}

function getWindowsOsName() {
  const build = Number.parseInt(os.release().split('.')[2] ?? '0', 10)
  if (build >= 22000) return 'Windows 11'
  if (build >= 10240) return 'Windows 10'
  return `Windows NT ${os.release()}`
}

function getOsLabel() {
  switch (process.platform) {
    case 'win32':
      return getWindowsOsName()
    case 'darwin':
      return `macOS ${os.release()}`
    case 'linux': {
      try {
        const pretty = execSync('lsb_release -ds 2>/dev/null', {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
        if (pretty) return pretty.replace(/^"|"$/g, '')
      } catch {
        /* ignore */
      }
      return `Linux ${os.release()}`
    }
    default:
      return `${os.type()} ${os.release()}`
  }
}

function getKernelLabel() {
  if (process.platform === 'win32') {
    return `${os.type()} ${os.release()} (${os.arch()})`
  }
  try {
    return execSync('uname -sr', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return `${os.type()} ${os.release()}`
  }
}

function detectShell() {
  if (process.env.NIOZY_SHELL_INTEGRATION === '1') {
    const comspec = (process.env.ComSpec ?? '').toLowerCase()
    if (comspec.includes('pwsh')) return 'pwsh (NioZy)'
    if (process.env.PSModulePath) return 'PowerShell (NioZy)'
  }
  return process.env.SHELL ?? process.env.ComSpec ?? 'unknown'
}

function getCpuLabel() {
  const cpus = os.cpus()
  if (cpus.length === 0) return 'unknown'
  const model = cpus[0].model.replace(/\s+/g, ' ').trim()
  const short = model.length > 48 ? `${model.slice(0, 45)}...` : model
  return `${short} (${cpus.length})`
}

function getTerminalLabel() {
  const program = process.env.TERM_PROGRAM
  const version = process.env.TERM_PROGRAM_VERSION
  if (program) {
    return version ? `${program} ${version}` : program
  }
  return process.env.TERM ?? 'unknown'
}

function getEmulatorLabel() {
  return process.env.NIOZY_TERMINAL_EMULATOR ?? null
}

function getLocaleLabel() {
  return (
    process.env.LANG ??
    process.env.LC_ALL ??
    process.env.LC_MESSAGES ??
    Intl.DateTimeFormat().resolvedOptions().locale ??
    'unknown'
  )
}

function collectInfoRows() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  const rows = [
    ['OS', getOsLabel()],
    ['Host', os.hostname()],
    ['Kernel', getKernelLabel()],
    ['Uptime', formatUptime(os.uptime())],
    ['Shell', detectShell()],
    ['Terminal', getTerminalLabel()],
  ]

  const emulator = getEmulatorLabel()
  if (emulator) rows.push(['Emulator', emulator])

  rows.push(
    ['CPU', getCpuLabel()],
    ['Memory', `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`],
    ['User', os.userInfo().username],
    ['Locale', getLocaleLabel()],
    ['Node', process.version.replace(/^v/, '')],
  )

  if (process.env.NIOZY_BIN) {
    rows.push(['NioZy Bin', process.env.NIOZY_BIN])
  }

  return rows
}

function printHelp() {
  process.stderr.write(`niozy-fetch — system info for NioZy terminal (fastfetch-style)

Usage:
  niozy-fetch [options]

Options:
  --no-logo       Skip ASCII logo
  --no-colors     Skip 256-color test palette
  --colors-only   Print only the color palette
  --help, -h      Show this help

Examples:
  niozy-fetch
  niozy-fetch --colors-only
`)
}

function parseArgs(argv) {
  let noLogo = false
  let noColors = false
  let colorsOnly = false

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--no-logo') {
      noLogo = true
      continue
    }
    if (arg === '--no-colors') {
      noColors = true
      continue
    }
    if (arg === '--colors-only') {
      colorsOnly = true
      continue
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
    throw new Error(`Unexpected argument: ${arg}`)
  }

  return { help: false, noLogo, noColors, colorsOnly }
}

function padVisible(text, width) {
  const visible = stripAnsi(text).length
  return visible >= width ? text : text + ' '.repeat(width - visible)
}

function printInfoBlock(rows, { noLogo }) {
  const labelWidth = Math.max(...rows.map(([label]) => label.length), 8)
  const infoLines = rows.map(([label, value]) => {
    return `${LABEL_COLOR}${label.padEnd(labelWidth)}${RESET}${SEP_COLOR}: ${RESET}${VALUE_COLOR}${value}${RESET}`
  })

  if (noLogo) {
    for (const line of infoLines) process.stdout.write(`${line}\n`)
    return
  }

  const logoLines = colorizeLogo()
  const height = Math.max(logoLines.length, infoLines.length)

  for (let i = 0; i < height; i++) {
    const logoPart = logoLines[i] ?? ''
    const infoPart = infoLines[i] ?? ''
    if (logoPart) {
      process.stdout.write(`${padVisible(logoPart, LOGO_WIDTH + 1)}${infoPart}\n`)
    } else {
      process.stdout.write(`${' '.repeat(LOGO_WIDTH + 1)}${infoPart}\n`)
    }
  }
}

function colorBlock(code, width = 2) {
  return `\x1b[48;5;${code}m${' '.repeat(width)}${RESET}`
}

function print256Palette() {
  process.stdout.write('\n')

  for (let i = 0; i < 8; i++) process.stdout.write(colorBlock(i))
  process.stdout.write('\n')
  for (let i = 8; i < 16; i++) process.stdout.write(colorBlock(i))
  process.stdout.write('\n')

  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const code = 16 + 36 * r + 6 * g + b
        process.stdout.write(colorBlock(code))
      }
    }
    process.stdout.write('\n')
  }

  for (let i = 232; i <= 255; i++) process.stdout.write(colorBlock(i))
  process.stdout.write('\n')

  process.stdout.write(`\n${DIM}256-color palette (0-255)${RESET}\n`)
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    printHelp()
    process.exit(0)
  }

  if (parsed.colorsOnly) {
    print256Palette()
    return
  }

  printInfoBlock(collectInfoRows(), { noLogo: parsed.noLogo })

  if (!parsed.noColors) {
    print256Palette()
  }
}

try {
  main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`niozy-fetch: ${message}\n`)
  process.exit(1)
}
