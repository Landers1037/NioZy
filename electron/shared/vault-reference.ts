/** 存储库变量引用，与 VaultStore.resolveText 一致 */
export const VAULT_REF_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

const VAULT_REF_TEST = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/

export function containsVaultReference(text: string): boolean {
  return VAULT_REF_TEST.test(text)
}

export function listVaultReferenceNames(text: string): string[] {
  const names: string[] = []
  const re = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g
  for (const match of text.matchAll(re)) {
    if (match[1]) names.push(match[1])
  }
  return names
}
