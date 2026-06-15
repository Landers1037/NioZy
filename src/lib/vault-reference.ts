/** Vault reference parse slot indices. */
export const VAULT_PARSE_SLOT_INDICES = [16, 59, 247] as const

export { containsVaultReference } from '../../electron/shared/vault-reference'

/** 在文本光标处插入存储库变量引用 */
export function insertVaultReference(text: string, key: string, cursor: number): string {
  const ref = `\${${key}}`
  return text.slice(0, cursor) + ref + text.slice(cursor)
}
