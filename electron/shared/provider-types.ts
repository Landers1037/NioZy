export type ProviderTool = 'claudeCode' | 'codex'

export type ProviderFileKey = 'claudeSettings' | 'codexAuth' | 'codexConfig'

export interface ProviderFileEntry {
  key: ProviderFileKey
  fileName: string
  content: string
}

export interface ProviderProfile {
  id: string
  tool: ProviderTool
  name: string
  files: ProviderFileEntry[]
  createdAt: string
  updatedAt: string
  importedFromExisting?: boolean
  backupDir?: string
}

export interface ProviderState {
  configDir: string
  providerFilePath: string
  backupDir: string
  activeProviderIds: Partial<Record<ProviderTool, string | null>>
  providers: ProviderProfile[]
}

export interface SaveProviderInput {
  id?: string
  tool: ProviderTool
  name: string
  files: Partial<Record<ProviderFileKey, string>>
}
