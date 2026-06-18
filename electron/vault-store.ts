import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { ensureConfigDir, getVaultFilePath } from './config-paths'
import { decryptSecret, encryptSecret } from './vault-crypto'
import { logErrorPayload, vaultLog } from './app-log'
import { resolveTextPure } from './shared/vault-resolve-pure'
import { runMainWorkerTask } from './workers/main-worker-pool'
import type { VaultResolveBatchResult } from './workers/main-worker-types'

export type VaultVariableType = 'plain' | 'secret'

export interface VaultVariableStored {
  id: string
  key: string
  type: VaultVariableType
  value: string
}

export interface VaultVariablePublic {
  id: string
  key: string
  type: VaultVariableType
  /** 明文变量有值；密文变量为 undefined */
  value?: string
}

interface VaultFile {
  variables: VaultVariableStored[]
}

export class VaultStore {
  private variables: VaultVariableStored[] = []

  load(): VaultVariablePublic[] {
    ensureConfigDir()
    const path = getVaultFilePath()
    if (!existsSync(path)) {
      this.variables = []
      return []
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as VaultFile
      this.variables = Array.isArray(raw.variables) ? raw.variables : []
    } catch {
      this.variables = []
    }
    return this.variables.map(toPublic)
  }

  getKeys(): string[] {
    return this.variables.map((v) => v.key)
  }

  save(input: {
    id?: string
    key: string
    type: VaultVariableType
    value?: string
  }): VaultVariablePublic {
    const key = input.key.trim()
    if (!key) throw new Error('变量名不能为空')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error('变量名仅允许字母、数字与下划线，且不能以数字开头')
    }

    const duplicate = this.variables.find(
      (v) => v.key === key && v.id !== (input.id ?? ''),
    )
    if (duplicate) throw new Error(`变量名「${key}」已存在`)

    if (input.type === 'plain') {
      const value = input.value ?? ''
      if (input.id) {
        const idx = this.variables.findIndex((v) => v.id === input.id)
        if (idx === -1) throw new Error('变量不存在')
        this.variables[idx] = { id: input.id, key, type: 'plain', value }
      } else {
        this.variables.push({ id: randomUUID(), key, type: 'plain', value })
      }
    } else {
      let storedValue: string
      if (input.id) {
        const existing = this.variables.find((v) => v.id === input.id)
        if (!existing || existing.type !== 'secret') throw new Error('变量不存在')
        if (input.value !== undefined && input.value !== '') {
          storedValue = encryptSecret(input.value)
        } else {
          storedValue = existing.value
        }
        const idx = this.variables.findIndex((v) => v.id === input.id)
        this.variables[idx] = { id: input.id, key, type: 'secret', value: storedValue }
      } else {
        if (!input.value) throw new Error('请填写密文变量的值')
        storedValue = encryptSecret(input.value)
        this.variables.push({ id: randomUUID(), key, type: 'secret', value: storedValue })
      }
    }

    this.persist()
    const saved = input.id
      ? this.variables.find((v) => v.id === input.id)!
      : this.variables[this.variables.length - 1]
    return toPublic(saved)
  }

  remove(id: string): void {
    this.variables = this.variables.filter((v) => v.id !== id)
    this.persist()
  }

  resolveText(text: string): string {
    this.load()
    return resolveTextPure(text, this.buildPlainVariableMap())
  }

  async resolveTexts(texts: string[]): Promise<string[]> {
    this.load()
    if (texts.length === 0) return []
    if (texts.length === 1) return [this.resolveText(texts[0]!)]
    const variables = this.buildPlainVariableMap()
    const { texts: resolved } = await runMainWorkerTask<VaultResolveBatchResult>(
      'vault:resolveBatch',
      { texts, variables },
    )
    return resolved
  }

  async resolveEnv(env: Record<string, string>): Promise<Record<string, string>> {
    this.load()
    const keys = Object.keys(env)
    if (keys.length === 0) return {}
    const texts = keys.map((key) => env[key]!)
    const resolved = await this.resolveTexts(texts)
    const out: Record<string, string> = {}
    keys.forEach((key, index) => {
      out[key] = resolved[index]!
    })
    return out
  }

  private buildPlainVariableMap(): Record<string, string> {
    const variables: Record<string, string> = {}
    for (const variable of this.variables) {
      if (variable.type === 'plain') {
        variables[variable.key] = variable.value
        continue
      }
      try {
        variables[variable.key] = decryptSecret(variable.value)
      } catch (err) {
        vaultLog.error('Failed to decrypt variable for resolve map', {
          name: variable.key,
          ...logErrorPayload(err),
        })
      }
    }
    return variables
  }

  private persist(): void {
    ensureConfigDir()
    const data: VaultFile = { variables: this.variables }
    writeFileSync(getVaultFilePath(), JSON.stringify(data, null, 2), 'utf-8')
  }
}

function toPublic(v: VaultVariableStored): VaultVariablePublic {
  if (v.type === 'plain') {
    return { id: v.id, key: v.key, type: v.type, value: v.value }
  }
  return { id: v.id, key: v.key, type: v.type }
}
