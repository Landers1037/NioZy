import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { ensureConfigDir, getVaultFilePath } from './config-paths'
import { VAULT_REF_PATTERN } from './shared/vault-reference'
import { decryptSecret, encryptSecret } from './vault-crypto'

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
    return text.replace(VAULT_REF_PATTERN, (_, name: string) => {
      const variable = this.variables.find((v) => v.key === name)
      if (!variable) return `\${${name}}`
      if (variable.type === 'plain') return variable.value
      try {
        return decryptSecret(variable.value)
      } catch {
        return `\${${name}}`
      }
    })
  }

  resolveEnv(env: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(env)) {
      out[k] = this.resolveText(v)
    }
    return out
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
