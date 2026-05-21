import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { CustomConnection } from './shared/api-types'
import { ensureConfigDir, getTermFilePath } from './config-paths'

export interface TermConfig {
  connections: CustomConnection[]
}

export class ConnectionsStore {
  private connections: CustomConnection[] = []
  private filePath = getTermFilePath()

  load(): CustomConnection[] {
    ensureConfigDir()
    this.filePath = getTermFilePath()
    if (!existsSync(this.filePath)) {
      this.connections = []
      return this.connections
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<TermConfig>
      this.connections = Array.isArray(raw.connections) ? raw.connections : []
    } catch {
      this.connections = []
    }
    return this.connections
  }

  get(): CustomConnection[] {
    return this.connections
  }

  save(connections: CustomConnection[]): CustomConnection[] {
    this.connections = connections
    ensureConfigDir()
    writeFileSync(this.filePath, JSON.stringify({ connections }, null, 2), 'utf-8')
    return this.connections
  }
}

export function parseConnectionsFromUnknown(data: unknown): CustomConnection[] {
  if (!data || typeof data !== 'object') return []
  const list = (data as { connections?: unknown }).connections
  return Array.isArray(list) ? (list as CustomConnection[]) : []
}
