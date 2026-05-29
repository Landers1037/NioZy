/** 存储库变量引用，与 VaultStore.resolveText 一致 */
export const VAULT_REF_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

const VAULT_REF_TEST = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/

export function containsVaultReference(text: string): boolean {
  return VAULT_REF_TEST.test(text)
}
