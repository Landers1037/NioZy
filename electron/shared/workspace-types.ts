export type WorkspaceGitFileStatus = 'added' | 'modified' | 'deleted'

export interface WorkspaceDirEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  mtimeMs?: number
}

export interface WorkspaceListDirResult {
  ok: true
  entries: WorkspaceDirEntry[]
}

export interface WorkspaceListDirError {
  ok: false
  error: string
}

export type WorkspaceListDirResponse = WorkspaceListDirResult | WorkspaceListDirError

export interface WorkspaceGitFile {
  path: string
  status: WorkspaceGitFileStatus
  additions: number
  deletions: number
}

export interface WorkspaceGitStatusResult {
  ok: true
  files: WorkspaceGitFile[]
}

export interface WorkspaceGitStatusError {
  ok: false
  error: 'GIT_NOT_FOUND' | 'NOT_GIT_REPO' | string
}

export type WorkspaceGitStatusResponse = WorkspaceGitStatusResult | WorkspaceGitStatusError

export interface WorkspaceGitDiffResult {
  ok: true
  diff: string
}

export interface WorkspaceGitDiffError {
  ok: false
  error: string
}

export type WorkspaceGitDiffResponse = WorkspaceGitDiffResult | WorkspaceGitDiffError

export interface WorkspaceDetectGitResult {
  ok: true
  isRepo: boolean
}

export interface WorkspaceDetectGitError {
  ok: false
  error: 'GIT_NOT_FOUND' | string
}

export type WorkspaceDetectGitResponse = WorkspaceDetectGitResult | WorkspaceDetectGitError

export interface WorkspaceGitBranchResult {
  ok: true
  branch: string | null
}

export interface WorkspaceGitBranchError {
  ok: false
  error: 'GIT_NOT_FOUND' | 'NOT_GIT_REPO' | string
}

export type WorkspaceGitBranchResponse = WorkspaceGitBranchResult | WorkspaceGitBranchError

export const WORKSPACE_TOOL_IDS = ['claude', 'opencode', 'pi', 'agent'] as const
export type WorkspaceToolId = (typeof WORKSPACE_TOOL_IDS)[number]

export const WORKSPACE_TOOL_COMMANDS: Record<WorkspaceToolId, string> = {
  claude: 'claude',
  opencode: 'opencode',
  pi: 'pi',
  agent: 'agent',
}
