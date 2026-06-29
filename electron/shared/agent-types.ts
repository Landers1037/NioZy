import type { AiProvider } from './ai-provider-settings'

export type AgentMode = 'plan' | 'build'

export type AgentConnectionState = 'idle' | 'starting' | 'ready' | 'error'

export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'status' | 'error'

export interface AgentReferencedFile {
  path: string
  relativePath: string
}

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  createdAt: string
  streaming?: boolean
  referencedFiles?: AgentReferencedFile[]
}

export interface AgentRuntimeConfig {
  provider: AiProvider
  model: string
  baseUrl: string
  apiKey: string
  maxTokens: number
}

export interface AgentRuntimeStatus {
  state: AgentConnectionState
  pid?: number
  lastError?: string
}

export interface AgentSessionState {
  sessionId: string
  workspaceDir: string
  gitBranch: string | null
  model: string
  mode: AgentMode
  messages: AgentMessage[]
}

export interface AgentStateSnapshot {
  runtime: AgentRuntimeStatus
  session: AgentSessionState
}

export type AgentEvent =
  | { type: 'runtime'; runtime: AgentRuntimeStatus }
  | { type: 'session'; session: AgentSessionState }
  | { type: 'message'; message: AgentMessage }
  | { type: 'messageDelta'; messageId: string; delta: string }
  | { type: 'messageDone'; messageId: string }
  | { type: 'error'; error: string; fatal?: boolean }

export interface AgentSendMessageInput {
  text: string
  referencedFiles?: AgentReferencedFile[]
}

export interface AgentFileSearchResult {
  path: string
  relativePath: string
  name: string
}

export type AgentBinarySource = 'workspace' | 'out' | 'config' | 'packaged' | 'missing'

export interface AgentBinaryStatus {
  activePath: string
  activeSource: AgentBinarySource
  downloadDir: string
  downloadPath: string
  downloadedBinaryExists: boolean
  candidatePaths: Array<{
    path: string
    source: Exclude<AgentBinarySource, 'missing'>
  }>
}

export type AgentBinaryDownloadResult =
  | {
      ok: true
      binaryPath: string
      releaseTag: string
      assetName: string
      overwritten: boolean
    }
  | {
      ok: false
      error: string
      code:
        | 'ALREADY_EXISTS'
        | 'NO_RELEASE_ASSET'
        | 'AMBIGUOUS_RELEASE_ASSET'
        | 'DOWNLOAD_FAILED'
        | 'HTTP_ERROR'
    }
