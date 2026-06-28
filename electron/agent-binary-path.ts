import { app } from 'electron'
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

function getCandidatePaths(): string[] {
  const exe = process.platform === 'win32' ? 'niozy-agent.exe' : 'niozy-agent'
  const mainDir = dirname(fileURLToPath(import.meta.url))

  return [
    resolve(process.cwd(), 'agent-runtime', 'build', 'agent', exe),
    resolve(process.cwd(), 'out', 'main', 'agent', exe),
    join(mainDir, 'agent', exe),
    join(process.resourcesPath, 'agent', exe),
  ]
}

export function resolveAgentBinaryPath(): string {
  const found = getCandidatePaths().find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error(`Agent runtime binary not found: ${getCandidatePaths().join(', ')}`)
  }
  return found
}

export function isPackagedAgentBinaryExpected(): boolean {
  return app.isPackaged
}
