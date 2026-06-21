import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { resolve } from 'path'
import { ensureConfigDir, getWorkspaceHistoryFilePath } from './config-paths'
import {
  normalizeWorkspaceHistory,
  type WorkspaceHistoryEntry,
  type WorkspaceHistoryRecordInput,
} from './shared/workspace-history-types'

const MAX_ENTRIES = 30

function normalizeWorkingDir(path: string): string {
  return resolve(path.trim())
}

function entryKey(input: WorkspaceHistoryRecordInput): string {
  return [
    normalizeWorkingDir(input.workingDir).toLowerCase(),
    input.selectedTool,
    input.command.trim(),
    JSON.stringify(input.args),
  ].join('\0')
}

export class WorkspaceHistoryStore {
  private entries: WorkspaceHistoryEntry[] = []
  private filePath = getWorkspaceHistoryFilePath()

  load(): WorkspaceHistoryEntry[] {
    ensureConfigDir()
    this.filePath = getWorkspaceHistoryFilePath()
    if (!existsSync(this.filePath)) {
      this.entries = []
      return this.entries
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown
      this.entries = normalizeWorkspaceHistory(raw)
    } catch {
      this.entries = []
    }
    return this.entries
  }

  get(): WorkspaceHistoryEntry[] {
    return this.entries
  }

  private save(): WorkspaceHistoryEntry[] {
    ensureConfigDir()
    writeFileSync(
      this.filePath,
      JSON.stringify({ entries: this.entries }, null, 2),
      'utf-8',
    )
    return this.entries
  }

  record(input: WorkspaceHistoryRecordInput): WorkspaceHistoryEntry[] {
    const workingDir = normalizeWorkingDir(input.workingDir)
    const command = input.command.trim()
    if (!workingDir || !command) return this.entries

    const normalizedInput: WorkspaceHistoryRecordInput = {
      workingDir,
      selectedTool: input.selectedTool,
      command,
      args: input.args,
    }
    const key = entryKey(normalizedInput)
    const now = Date.now()
    const existing = this.entries.find((entry) => entryKey(entry) === key)

    if (existing) {
      const updated: WorkspaceHistoryEntry = { ...existing, lastUsedAt: now }
      this.entries = [updated, ...this.entries.filter((entry) => entry.id !== existing.id)]
    } else {
      const created: WorkspaceHistoryEntry = {
        id: randomUUID(),
        workingDir,
        selectedTool: normalizedInput.selectedTool,
        command,
        args: [...normalizedInput.args],
        lastUsedAt: now,
      }
      this.entries = [created, ...this.entries]
    }

    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES)
    }

    return this.save()
  }
}
