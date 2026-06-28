import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import {
  ensureConfigDir,
  ensureProviderBackupsDir,
  getConfigDir,
  getProviderBackupsDir,
  getProviderFilePath,
} from './config-paths'
import type {
  ProviderFileEntry,
  ProviderFileKey,
  ProviderProfile,
  ProviderState,
  ProviderTool,
  SaveProviderInput,
} from './shared/provider-types'

type ProviderStoreFile = {
  version: 1
  activeProviderIds: Partial<Record<ProviderTool, string | null>>
  providers: ProviderProfile[]
}

type ProviderFileDescriptor = {
  key: ProviderFileKey
  fileName: string
  targetPath: string
}

const home = process.env.USERPROFILE || homedir()

const TOOL_FILE_MAP: Record<ProviderTool, ProviderFileDescriptor[]> = {
  claudeCode: [
    {
      key: 'claudeSettings',
      fileName: 'settings.json',
      targetPath: join(home, '.claude', 'settings.json'),
    },
  ],
  codex: [
    {
      key: 'codexAuth',
      fileName: 'auth.json',
      targetPath: join(home, '.codex', 'auth.json'),
    },
    {
      key: 'codexConfig',
      fileName: 'config.toml',
      targetPath: join(home, '.codex', 'config.toml'),
    },
  ],
}

function isProviderTool(value: unknown): value is ProviderTool {
  return value === 'claudeCode' || value === 'codex'
}

function createDefaultStoreFile(): ProviderStoreFile {
  return {
    version: 1,
    activeProviderIds: {
      claudeCode: null,
      codex: null,
    },
    providers: [],
  }
}

function safeReadText(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function normalizeProviderFiles(
  tool: ProviderTool,
  files: Partial<Record<ProviderFileKey, string>>,
): ProviderFileEntry[] {
  return TOOL_FILE_MAP[tool].map((descriptor) => ({
    key: descriptor.key,
    fileName: descriptor.fileName,
    content: files[descriptor.key] ?? '',
  }))
}

function readProviderFiles(profile: ProviderProfile): Partial<Record<ProviderFileKey, string>> {
  return Object.fromEntries(profile.files.map((file) => [file.key, file.content]))
}

function createImportedProvider(tool: ProviderTool): ProviderProfile | null {
  const descriptors = TOOL_FILE_MAP[tool]
  const existing = descriptors.filter((descriptor) => existsSync(descriptor.targetPath))
  if (existing.length === 0) return null

  ensureProviderBackupsDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(getProviderBackupsDir(), `${tool}-${stamp}`)
  mkdirSync(backupDir, { recursive: true })

  const files = descriptors.map((descriptor) => {
    const content = safeReadText(descriptor.targetPath)
    if (existsSync(descriptor.targetPath)) {
      writeFileSync(join(backupDir, descriptor.fileName), content, 'utf-8')
    }
    return {
      key: descriptor.key,
      fileName: descriptor.fileName,
      content,
    } satisfies ProviderFileEntry
  })

  const now = new Date().toISOString()
  return {
    id: `${tool}-imported-${Date.now()}`,
    tool,
    name: tool === 'claudeCode' ? 'Claude Code (Imported)' : 'Codex (Imported)',
    files,
    createdAt: now,
    updatedAt: now,
    importedFromExisting: true,
    backupDir,
  }
}

export class ProviderStore {
  private state: ProviderStoreFile = createDefaultStoreFile()
  private filePath = getProviderFilePath()
  private loaded = false

  load(): ProviderState {
    ensureConfigDir()
    this.filePath = getProviderFilePath()
    this.state = this.readStoreFile()
    this.bootstrapFromExistingConfigsIfNeeded()
    this.loaded = true
    return this.getState()
  }

  getState(): ProviderState {
    if (!this.loaded) return this.load()
    return {
      configDir: getConfigDir(),
      providerFilePath: this.filePath,
      backupDir: getProviderBackupsDir(),
      activeProviderIds: { ...this.state.activeProviderIds },
      providers: this.state.providers.map((provider) => ({
        ...provider,
        files: provider.files.map((file) => ({ ...file })),
      })),
    }
  }

  saveProvider(input: SaveProviderInput): ProviderState {
    if (!this.loaded) this.load()
    const name = input.name.trim()
    if (!name) throw new Error('Provider name is required')
    const files = normalizeProviderFiles(input.tool, input.files)
    const now = new Date().toISOString()
    const existingIndex = input.id
      ? this.state.providers.findIndex((provider) => provider.id === input.id)
      : -1

    if (existingIndex >= 0) {
      const existing = this.state.providers[existingIndex]
      const wasActive = this.state.activeProviderIds[existing.tool] === existing.id
      const next: ProviderProfile = {
        ...existing,
        name,
        tool: input.tool,
        files,
        updatedAt: now,
      }
      this.state.providers[existingIndex] = next
      if (existing.tool !== next.tool && wasActive) {
        this.state.activeProviderIds[existing.tool] = null
      }
      this.persist()
      if (wasActive || this.state.activeProviderIds[input.tool] === next.id) {
        this.applyProvider(next)
        this.state.activeProviderIds[next.tool] = next.id
        this.persist()
      }
      return this.getState()
    }

    const created: ProviderProfile = {
      id: `${input.tool}-${Date.now()}`,
      tool: input.tool,
      name,
      files,
      createdAt: now,
      updatedAt: now,
    }
    this.state.providers.push(created)
    this.persist()
    return this.getState()
  }

  deleteProvider(id: string): ProviderState {
    if (!this.loaded) this.load()
    const target = this.state.providers.find((provider) => provider.id === id)
    if (!target) return this.getState()
    this.state.providers = this.state.providers.filter((provider) => provider.id !== id)
    if (this.state.activeProviderIds[target.tool] === id) {
      this.state.activeProviderIds[target.tool] = null
    }
    this.persist()
    return this.getState()
  }

  activateProvider(id: string): ProviderState {
    if (!this.loaded) this.load()
    const provider = this.state.providers.find((item) => item.id === id)
    if (!provider) throw new Error('Provider not found')
    this.applyProvider(provider)
    this.state.activeProviderIds[provider.tool] = provider.id
    this.persist()
    return this.getState()
  }

  private applyProvider(provider: ProviderProfile): void {
    const descriptorMap = new Map(
      TOOL_FILE_MAP[provider.tool].map((descriptor) => [descriptor.key, descriptor]),
    )
    for (const file of provider.files) {
      const descriptor = descriptorMap.get(file.key)
      if (!descriptor) continue
      mkdirSync(dirname(descriptor.targetPath), { recursive: true })
      writeFileSync(descriptor.targetPath, file.content, 'utf-8')
    }
  }

  private bootstrapFromExistingConfigsIfNeeded(): void {
    if (this.state.providers.length > 0) return
    const imported = (['claudeCode', 'codex'] as const)
      .map((tool) => createImportedProvider(tool))
      .filter((item): item is ProviderProfile => item !== null)
    if (imported.length === 0) return
    this.state.providers = imported
    this.state.activeProviderIds = {
      claudeCode: null,
      codex: null,
    }
    this.persist()
  }

  private readStoreFile(): ProviderStoreFile {
    if (!existsSync(this.filePath)) return createDefaultStoreFile()
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<ProviderStoreFile>
      const providers = Array.isArray(raw.providers)
        ? raw.providers
            .filter((provider): provider is ProviderProfile => {
              return (
                provider !== null &&
                typeof provider === 'object' &&
                typeof provider.id === 'string' &&
                isProviderTool(provider.tool) &&
                typeof provider.name === 'string' &&
                Array.isArray(provider.files)
              )
            })
            .map((provider) => ({
              ...provider,
              files: normalizeProviderFiles(provider.tool, readProviderFiles(provider)),
            }))
        : []
      return {
        version: 1,
        activeProviderIds: {
          claudeCode: raw.activeProviderIds?.claudeCode ?? null,
          codex: raw.activeProviderIds?.codex ?? null,
        },
        providers,
      }
    } catch {
      return createDefaultStoreFile()
    }
  }

  private persist(): void {
    ensureConfigDir()
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }
}
