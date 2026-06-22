#!/usr/bin/env node
/**
 * NioZy built-in image viewer — outputs iTerm IIP or Kitty graphics protocol sequences.
 * Usage: niozy-cat [options] <image> [image...]
 */

import { readFileSync, statSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
/** 单帧 base64 过大时会在 IPC 分块中被截断，导致终端显示 base64 文本 */
const MAX_IMAGE_BYTES = 512 * 1024
/** Kitty 图形协议单 chunk 载荷上限（字节，base64 字符数） */
const KITTY_CHUNK_CHARS = 4096

function resolveImageProtocol() {
  const raw = (process.env.NIOZY_IMAGE_PROTOCOL ?? 'iip').toLowerCase()
  return raw === 'kitty' ? 'kitty' : 'iip'
}

function printHelp() {
  const protocol = resolveImageProtocol()
  process.stderr.write(`niozy-cat — display images in NioZy terminal (${protocol === 'kitty' ? 'Kitty graphics' : 'iTerm IIP'})

Usage:
  niozy-cat [options] <image> [image...]

Options:
  --width <cols>   Max width in terminal cells (default: 40)
  --help, -h       Show this help

Clear the image: Ctrl+K, or run clear / cls in the terminal.

Supported formats: PNG, JPEG, GIF
Requires terminal inline images enabled in NioZy Settings -> SHELL.
Protocol: ${protocol} (from NIOZY_IMAGE_PROTOCOL; ghostty 渲染时为 kitty)
`)
}

function parseArgs(argv) {
  const files = []
  let maxCols = 40

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      return { help: true, files: [], maxCols }
    }
    if (arg === '--width') {
      const next = argv[++i]
      const n = Number.parseInt(next ?? '', 10)
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Invalid --width value: ${next ?? ''}`)
      }
      maxCols = n
      continue
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
    files.push(arg)
  }

  return { help: false, files, maxCols }
}

function readPngDimensions(buffer) {
  if (buffer.length < 24) return null
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function detectImageFormat(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return 'png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return 'gif'
  }
  return null
}

function guessDimensions(buffer) {
  const png = readPngDimensions(buffer)
  if (png) return png
  return { width: 800, height: 600 }
}

function computeCellSpan(widthPx, heightPx, maxCols, maxRows = 24) {
  const cellW = 10
  const cellH = 20
  const cols = Math.min(maxCols, Math.max(1, Math.ceil(widthPx / cellW)))
  const rows = Math.min(
    maxRows,
    Math.max(1, Math.ceil((heightPx / Math.max(1, widthPx)) * cols * (cellW / cellH))),
  )
  return { cols, rows }
}

/** iTerm inline image protocol: OSC 1337 ; File = ... : base64 ST */
function writeIipImage(buffer, { cols, rows }) {
  const b64 = buffer.toString('base64')
  const params = `inline=1;size=${buffer.length};width=${cols};height=${rows};preserveAspectRatio=1`
  process.stdout.write(`\x1b]1337;File=${params}:${b64}\x1b\\`)
}

/** Kitty graphics protocol: APC ESC _ G ... ESC \\ */
function writeKittyImage(buffer, { width, height, cols, rows }) {
  const b64 = buffer.toString('base64')
  const header = `a=t,f=100,s=${width},v=${height},c=${cols},r=${rows}`

  if (b64.length <= KITTY_CHUNK_CHARS) {
    process.stdout.write(`\x1b_G${header};${b64}\x1b\\`)
    return
  }

  let offset = 0
  let first = true
  while (offset < b64.length) {
    const chunk = b64.slice(offset, offset + KITTY_CHUNK_CHARS)
    offset += KITTY_CHUNK_CHARS
    const isLast = offset >= b64.length
    if (first) {
      process.stdout.write(`\x1b_G${header},m=${isLast ? 1 : 0};${chunk}\x1b\\`)
      first = false
    } else {
      process.stdout.write(`\x1b_Gm=${isLast ? 1 : 0};${chunk}\x1b\\`)
    }
  }
}

function displayImage(filePath, maxCols) {
  const resolved = resolve(filePath)
  const ext = extname(resolved).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported image format: ${basename(resolved)}`)
  }

  let stat
  try {
    stat = statSync(resolved)
  } catch {
    throw new Error(`File not found: ${resolved}`)
  }
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${resolved}`)
  }

  const buffer = readFileSync(resolved)
  if (buffer.length === 0) {
    throw new Error(`Empty file: ${resolved}`)
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${basename(resolved)}: file too large (${buffer.length} bytes, max ${MAX_IMAGE_BYTES}). Resize or compress the image first.`,
    )
  }

  const format = detectImageFormat(buffer)
  if (!format) {
    throw new Error(
      `${basename(resolved)}: requires PNG, JPEG, or GIF. Convert the image first.`,
    )
  }

  const { width, height } = guessDimensions(buffer)
  const { cols, rows } = computeCellSpan(width, height, maxCols)
  const protocol = resolveImageProtocol()

  if (protocol === 'kitty') {
    writeKittyImage(buffer, { width, height, cols, rows })
  } else {
    writeIipImage(buffer, { cols, rows })
  }
  process.stdout.write('\r\n')
}

function main() {
  const { help, files, maxCols } = parseArgs(process.argv.slice(2))
  if (help) {
    printHelp()
    process.exit(0)
  }
  if (files.length === 0) {
    printHelp()
    process.exit(1)
  }

  for (const file of files) {
    displayImage(file, maxCols)
  }
}

try {
  main()
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`niozy-cat: ${message}\n`)
  process.exit(1)
}
