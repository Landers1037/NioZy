import type { AiChatContextPayload, AiRuleStates, AiSkillSummary } from '../shared/ai-context-types'
import type { GitCommitDetail, GitGraphRow } from '../shared/repo-types'
import type { ClaudeCodeSessionEntry, ProjectSessionGroup } from '../shared/session-types'
import type { SettingsImportParseError } from '../shared/settings-import-parse'

export type MainWorkerTask =
  | 'session:parseClaudeCode'
  | 'session:parseOpenCode'
  | 'git:parseGraphLog'
  | 'git:parseCommitDetail'
  | 'ai:assembleChatContext'
  | 'ai:assembleSkillSummaries'
  | 'settings:parseImport'
  | 'fonts:fetchAndNormalize'
  | 'vault:resolveBatch'
  | 'p2p:encryptPayload'
  | 'p2p:decryptPayload'

export type MainWorkerRequest = {
  id: string
  task: MainWorkerTask
  payload: unknown
}

export type MainWorkerResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string }

export interface SessionParseClaudeCodePayload {
  content: string
}

export interface SessionParseClaudeCodeResult {
  sessions: ClaudeCodeSessionEntry[]
  groups: ProjectSessionGroup[]
}

export interface SessionParseOpenCodePayload {
  dbBuffer: Uint8Array
}

export interface GitParseGraphLogPayload {
  stdout: string
  recordSep: string
  cursorSha?: string
}

export interface GitParseGraphLogResult {
  rows: GitGraphRow[]
}

export interface GitParseCommitDetailPayload {
  showStdout: string
  numstatStdout: string
  statusStdout: string
}

export interface AiAssembleChatContextPayload {
  ruleFiles: Array<{ id: string; content: string }>
  skillFiles: Array<{ id: string; content: string }>
  ruleStates: AiRuleStates
}

export interface AiAssembleSkillSummariesPayload {
  skillFiles: Array<{ id: string; content: string }>
}

export interface SettingsParseImportPayload {
  content: string
}

export type SettingsParseImportResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: SettingsImportParseError }

export interface VaultResolveBatchPayload {
  texts: string[]
  variables: Record<string, string>
}

export interface VaultResolveBatchResult {
  texts: string[]
}

export interface P2pEncryptPayload {
  sessionKeyBase64: string
  plaintext: string
}

export interface P2pDecryptPayload {
  sessionKeyBase64: string
  encrypted: string
}

export interface P2pCryptoResult {
  result: string
}

export type { AiChatContextPayload, AiSkillSummary }
