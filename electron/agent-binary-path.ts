import { app } from 'electron'
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { getAgentBinaryDir } from './config-paths'

export type AgentBinarySource = 'workspace' | 'out' | 'config' | 'packaged' | 'missing'

export interface AgentBinaryCandidate {
  path: string
  source: Exclude<AgentBinarySource, 'missing'>
}

export function getAgentExecutableName(): string {
  return process.platform === 'win32' ? 'niozy-agent.exe' : 'niozy-agent'
}

export function getDownloadedAgentBinaryPath(): string {
  return join(getAgentBinaryDir(), getAgentExecutableName())
}

export function getAgentBinaryCandidates(): AgentBinaryCandidate[] {
  const exe = getAgentExecutableName()
  const mainDir = dirname(fileURLToPath(import.meta.url))

  return [
    {
      path: resolve(process.cwd(), 'agent-runtime', 'build', 'agent', exe),
      source: 'workspace',
    },
    {
      path: getDownloadedAgentBinaryPath(),
      source: 'config',
    },
    {
      path: resolve(process.cwd(), 'out', 'main', 'agent', exe),
      source: 'out',
    },
    {
      path: join(mainDir, 'agent', exe),
      source: 'packaged',
    },
    {
      path: join(process.resourcesPath, 'agent', exe),
      source: 'packaged',
    },
  ]
}

export function resolveAgentBinaryPath(): string {
  const found = getAgentBinaryCandidates().find((candidate) => existsSync(candidate.path))
  if (!found) {
    throw new Error(
      `Agent runtime binary not found: ${getAgentBinaryCandidates()
        .map((candidate) => candidate.path)
        .join(', ')}`,
    )
  }
  return found.path
}

export function inspectAgentBinaryPath(): { path: string; source: AgentBinarySource } {
  const found = getAgentBinaryCandidates().find((candidate) => existsSync(candidate.path))
  if (!found) {
    return { path: getDownloadedAgentBinaryPath(), source: 'missing' }
  }
  return { path: found.path, source: found.source }
}

export function isPackagedAgentBinaryExpected(): boolean {
  return app.isPackaged
}
