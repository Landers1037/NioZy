import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'node:url'

const MAIN_DIR =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url))

const BIN_NAME = process.platform === 'win32' ? 'niozy-mux-core.exe' : 'niozy-mux-core'

function packagedCandidates(): string[] {
  return [
    join(process.resourcesPath, 'bin', BIN_NAME),
    join(process.resourcesPath, 'app.asar.unpacked', 'bin', BIN_NAME),
    join(process.resourcesPath, 'niozy-mux-core', BIN_NAME),
  ]
}

function devCandidates(): string[] {
  const roots = [
    process.cwd(),
    join(process.cwd(), '..'),
    join(MAIN_DIR, '..', '..'),
  ]
  const profiles = ['release', 'debug'] as const
  const out: string[] = []
  for (const root of roots) {
    for (const profile of profiles) {
      out.push(join(root, 'niozy-mux-core', 'target', profile, BIN_NAME))
    }
  }
  return out
}

/** Resolve path to niozy-mux-core binary (dev: cargo build output; packaged: resources/bin). */
export function getMuxCoreBinaryPath(): string | null {
  const candidates = app.isPackaged ? packagedCandidates() : devCandidates()
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}
