import {
  WORKSPACE_TOOL_IDS,
  type WorkspaceToolId,
} from './workspace-types'

export interface WorkspaceHistoryEntry {
  id: string
  workingDir: string
  selectedTool: WorkspaceToolId
  command: string
  args: string[]
  lastUsedAt: number
}

export interface WorkspaceHistoryConfig {
  entries: WorkspaceHistoryEntry[]
}

export interface WorkspaceHistoryRecordInput {
  workingDir: string
  selectedTool: WorkspaceToolId
  command: string
  args: string[]
}

function isWorkspaceToolId(value: unknown): value is WorkspaceToolId {
  return typeof value === 'string' && (WORKSPACE_TOOL_IDS as readonly string[]).includes(value)
}

export function normalizeWorkspaceHistory(value: unknown): WorkspaceHistoryEntry[] {
  if (!value || typeof value !== 'object') return []
  const raw = value as Partial<WorkspaceHistoryConfig>
  if (!Array.isArray(raw.entries)) return []

  const out: WorkspaceHistoryEntry[] = []
  for (const item of raw.entries) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Partial<WorkspaceHistoryEntry>
    if (typeof entry.id !== 'string' || !entry.id.trim()) continue
    if (typeof entry.workingDir !== 'string' || !entry.workingDir.trim()) continue
    if (!isWorkspaceToolId(entry.selectedTool)) continue
    if (typeof entry.command !== 'string' || !entry.command.trim()) continue
    const args = Array.isArray(entry.args)
      ? entry.args.filter((arg): arg is string => typeof arg === 'string')
      : []
    const lastUsedAt =
      typeof entry.lastUsedAt === 'number' && Number.isFinite(entry.lastUsedAt)
        ? entry.lastUsedAt
        : 0
    out.push({
      id: entry.id.trim(),
      workingDir: entry.workingDir.trim(),
      selectedTool: entry.selectedTool,
      command: entry.command.trim(),
      args,
      lastUsedAt,
    })
  }
  return out
}
