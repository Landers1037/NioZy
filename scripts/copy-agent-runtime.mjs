import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const exe = process.platform === 'win32' ? 'niozy-agent.exe' : 'niozy-agent'
const src = resolve('agent-runtime', 'build', 'agent', exe)
const outDir = resolve('out', 'main', 'agent')
const dest = resolve(outDir, exe)

if (!existsSync(src)) {
  console.error(`Agent runtime binary not found: ${src}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
copyFileSync(src, dest)
console.log(`Copied agent runtime to ${dest}`)
